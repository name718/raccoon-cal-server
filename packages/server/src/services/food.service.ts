import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import {
  awardXp,
  calcSatietyDelta,
  checkAndDeductHp,
  XP_RULES,
} from '@/utils/gamificationEngine';

// ─── 类型 ────────────────────────────────────────────────────────────────────

/** 保存饮食记录的入参 */
export interface SaveFoodRecordInput {
  foodName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  servingSize?: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  imageUrl?: string;
  recordedAt?: Date;
}

/** 按餐次分组的饮食记录 */
export interface MealGroup {
  mealType: string;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  records: FoodRecordItem[];
}

/** 单条饮食记录（对外暴露） */
export interface FoodRecordItem {
  id: number;
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  servingSize: number;
  mealType: string;
  imageUrl: string | null;
  recordedAt: Date;
}

/** 每日卡路里汇总 */
export interface DailyCalSummary {
  date: string;
  totalCalories: number;
  mealGroups: MealGroup[];
}

/** 每日卡路里数据点（用于折线图） */
export interface DailyCalories {
  date: string;
  calories: number;
}

/** N 天营养统计 */
export interface NutritionStats {
  dailyCalories: DailyCalories[];
  avgProtein: number;
  avgFat: number;
  avgCarbs: number;
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 将 Date 格式化为 YYYY-MM-DD 字符串（UTC） */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 获取某日 UTC 的起止时间 */
function getDayRange(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00.000Z`),
    end: new Date(`${dateStr}T23:59:59.999Z`),
  };
}

// ─── 服务函数 ─────────────────────────────────────────────────────────────────

/**
 * 保存一条饮食记录。
 *
 * @param userId 用户 ID
 * @param data   饮食记录数据
 * @returns 新创建的饮食记录
 */
export async function saveFoodRecord(
  userId: number,
  data: SaveFoodRecordInput
) {
  const record = await prisma.foodRecord.create({
    data: {
      userId,
      foodName: data.foodName,
      calories: data.calories,
      protein: data.protein ?? 0,
      fat: data.fat ?? 0,
      carbs: data.carbs ?? 0,
      fiber: data.fiber ?? 0,
      servingSize: data.servingSize ?? 100,
      mealType: data.mealType,
      imageUrl: data.imageUrl ?? null,
      recordedAt: data.recordedAt ?? new Date(),
    },
  });

  logger.info('food.service: record saved', {
    userId,
    recordId: record.id,
    mealType: record.mealType,
    calories: record.calories,
  });

  // Fire-and-forget gamification side effects (errors must not fail the main save)
  triggerFoodRecordSideEffects(
    userId,
    record.id,
    record.calories,
    record.recordedAt
  ).catch(err =>
    logger.error('food.service: side effects error', {
      userId,
      recordId: record.id,
      err,
    })
  );

  return record;
}

/**
 * 保存饮食记录后触发的游戏化副作用（fire-and-forget）：
 * 1. 授予 XP (+10)
 * 2. 检查并扣减 HP（超标时）
 * 3. 更新浣熊饱食度
 * 4. 写入 Redis 打卡标记
 */
async function triggerFoodRecordSideEffects(
  userId: number,
  recordId: number,
  recordCalories: number,
  recordedAt: Date
): Promise<void> {
  const date = toDateString(recordedAt);

  // 1. 授予 XP (+10)，幂等 refId = recordId
  try {
    await awardXp(
      userId,
      'food_record',
      String(recordId),
      XP_RULES.food_record
    );
  } catch (err) {
    logger.error('food.service: awardXp failed', { userId, recordId, err });
  }

  // 2. 检查并扣减 HP（超标 10% 时）
  try {
    await checkAndDeductHp(userId, date);
  } catch (err) {
    logger.error('food.service: checkAndDeductHp failed', {
      userId,
      date,
      err,
    });
  }

  // 3. 更新浣熊饱食度
  try {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (profile) {
      const pet = await prisma.pet.findUnique({ where: { userId } });
      if (pet) {
        const delta = calcSatietyDelta(recordCalories, profile.dailyCalTarget);
        const newSatiety = Math.min(100, Math.max(0, pet.satiety + delta));
        await prisma.pet.update({
          where: { userId },
          data: { satiety: newSatiety },
        });
        logger.debug('food.service: pet satiety updated', {
          userId,
          oldSatiety: pet.satiety,
          newSatiety,
        });
      }
    }
  } catch (err) {
    logger.error('food.service: pet satiety update failed', { userId, err });
  }

  // 4. 写入 Redis 打卡标记（key: checkin:flag:{userId}:{YYYY-MM-DD}，TTL 至当日午夜）
  try {
    const now = new Date();
    const midnight = new Date(`${toDateString(now)}T23:59:59.999Z`);
    const ttlSeconds = Math.max(
      1,
      Math.floor((midnight.getTime() - now.getTime()) / 1000)
    );
    const checkinKey = `checkin:flag:${userId}:${date}`;
    await redis.set(checkinKey, '1', 'EX', ttlSeconds);
    logger.debug('food.service: checkin flag set', {
      userId,
      date,
      ttlSeconds,
    });
  } catch (err) {
    logger.error('food.service: checkin flag write failed', {
      userId,
      date,
      err,
    });
  }
}

/**
 * 获取用户的饮食记录，可按日期过滤。
 *
 * @param userId 用户 ID
 * @param date   可选，格式 YYYY-MM-DD；不传则返回全部记录（最近 100 条）
 * @returns 饮食记录列表
 */
export async function getFoodRecords(
  userId: number,
  date?: string
): Promise<FoodRecordItem[]> {
  const dateFilter = date ? getDayRange(date) : null;

  const records = await prisma.foodRecord.findMany({
    where: {
      userId,
      ...(dateFilter
        ? { recordedAt: { gte: dateFilter.start, lte: dateFilter.end } }
        : {}),
    },
    orderBy: { recordedAt: 'asc' },
    take: date ? undefined : 100,
  });

  return records.map(r => ({
    id: r.id,
    foodName: r.foodName,
    calories: r.calories,
    protein: r.protein,
    fat: r.fat,
    carbs: r.carbs,
    fiber: r.fiber,
    servingSize: r.servingSize,
    mealType: r.mealType,
    imageUrl: r.imageUrl,
    recordedAt: r.recordedAt,
  }));
}

/**
 * 删除一条饮食记录（含所有权校验）。
 *
 * @param userId   用户 ID
 * @param recordId 记录 ID
 * @throws Error 若记录不存在或不属于该用户
 */
export async function deleteFoodRecord(
  userId: number,
  recordId: number
): Promise<void> {
  const record = await prisma.foodRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    throw Object.assign(new Error('Food record not found'), {
      code: 'RECORD_NOT_FOUND',
    });
  }

  if (record.userId !== userId) {
    throw Object.assign(
      new Error('Forbidden: record does not belong to user'),
      { code: 'FORBIDDEN' }
    );
  }

  await prisma.foodRecord.delete({ where: { id: recordId } });

  logger.info('food.service: record deleted', { userId, recordId });
}

/**
 * 获取某日卡路里汇总，按餐次分组。
 *
 * @param userId 用户 ID
 * @param date   格式 YYYY-MM-DD，不传则使用今日（UTC）
 * @returns 当日卡路里汇总
 */
export async function getDailyCalSummary(
  userId: number,
  date?: string
): Promise<DailyCalSummary> {
  const targetDate = date ?? toDateString(new Date());
  const { start, end } = getDayRange(targetDate);

  const records = await prisma.foodRecord.findMany({
    where: {
      userId,
      recordedAt: { gte: start, lte: end },
    },
    orderBy: { recordedAt: 'asc' },
  });

  // 按餐次分组
  const groupMap = new Map<string, FoodRecordItem[]>();
  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];

  for (const r of records) {
    const items = groupMap.get(r.mealType) ?? [];
    items.push({
      id: r.id,
      foodName: r.foodName,
      calories: r.calories,
      protein: r.protein,
      fat: r.fat,
      carbs: r.carbs,
      fiber: r.fiber,
      servingSize: r.servingSize,
      mealType: r.mealType,
      imageUrl: r.imageUrl,
      recordedAt: r.recordedAt,
    });
    groupMap.set(r.mealType, items);
  }

  const buildMealGroup = (mt: string, items: FoodRecordItem[]): MealGroup => ({
    mealType: mt,
    totalCalories: items.reduce((sum, i) => sum + i.calories, 0),
    totalProtein: items.reduce((sum, i) => sum + i.protein, 0),
    totalFat: items.reduce((sum, i) => sum + i.fat, 0),
    totalCarbs: items.reduce((sum, i) => sum + i.carbs, 0),
    records: items,
  });

  const mealGroups: MealGroup[] = mealOrder
    .filter(mt => groupMap.has(mt))
    .map(mt => buildMealGroup(mt, groupMap.get(mt) ?? []));

  // 包含不在预设顺序中的餐次类型
  for (const [mt, items] of groupMap.entries()) {
    if (!mealOrder.includes(mt)) {
      mealGroups.push(buildMealGroup(mt, items));
    }
  }

  const totalCalories = mealGroups.reduce((sum, g) => sum + g.totalCalories, 0);

  return { date: targetDate, totalCalories, mealGroups };
}

/**
 * 获取过去 N 天的营养统计数据。
 *
 * @param userId 用户 ID
 * @param days   天数（含今日），例如 7 表示最近 7 天
 * @returns 营养统计
 */
export async function getNutritionStats(
  userId: number,
  days: number
): Promise<NutritionStats> {
  const today = toDateString(new Date());
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(`${today}T23:59:59.999Z`);

  const records = await prisma.foodRecord.findMany({
    where: {
      userId,
      recordedAt: { gte: startDate, lte: endDate },
    },
    orderBy: { recordedAt: 'asc' },
  });

  // 按日期聚合
  const dayMap = new Map<
    string,
    { calories: number; protein: number; fat: number; carbs: number }
  >();

  // 初始化所有日期（确保无记录的日期也出现在结果中）
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);
    dayMap.set(toDateString(d), { calories: 0, protein: 0, fat: 0, carbs: 0 });
  }

  for (const r of records) {
    const dateKey = toDateString(r.recordedAt);
    const existing = dayMap.get(dateKey);
    if (existing) {
      existing.calories += r.calories;
      existing.protein += r.protein;
      existing.fat += r.fat;
      existing.carbs += r.carbs;
    }
  }

  const dailyCalories: DailyCalories[] = [];
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;

  for (const [date, agg] of dayMap.entries()) {
    dailyCalories.push({ date, calories: agg.calories });
    totalProtein += agg.protein;
    totalFat += agg.fat;
    totalCarbs += agg.carbs;
  }

  // 按日期升序排列
  dailyCalories.sort((a, b) => a.date.localeCompare(b.date));

  const avgProtein = days > 0 ? totalProtein / days : 0;
  const avgFat = days > 0 ? totalFat / days : 0;
  const avgCarbs = days > 0 ? totalCarbs / days : 0;

  logger.debug('food.service: nutrition stats computed', {
    userId,
    days,
    recordCount: records.length,
  });

  return { dailyCalories, avgProtein, avgFat, avgCarbs };
}
