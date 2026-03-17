import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import { awardXp, calcPetMood } from '@/utils/gamificationEngine';

// ─── 类型 ────────────────────────────────────────────────────────────────────

/** 宠物装扮槽位入参 */
export interface PetOutfitInput {
  hat?: string | null;
  clothes?: string | null;
  accessory?: string | null;
}

/** 宠物状态（对外暴露） */
export interface PetStatusResult {
  id: number;
  name: string;
  satiety: number;
  mood: string;
  hatSlot: string | null;
  clothSlot: string | null;
  accessSlot: string | null;
  /** 来自 GamificationStatus */
  level: number;
  totalXp: number;
}

/** 互动结果 */
export interface InteractResult {
  xpAwarded: number;
  alreadyInteracted: boolean;
}

// ─── 缓存键 ──────────────────────────────────────────────────────────────────

const PET_STATUS_TTL = 600; // 10 分钟

function petStatusCacheKey(userId: number): string {
  return `pet:status:${userId}`;
}

function petInteractCacheKey(userId: number, date: string): string {
  return `pet:interact:${userId}:${date}`;
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 将 Date 格式化为 YYYY-MM-DD 字符串（UTC） */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ─── 服务函数 ─────────────────────────────────────────────────────────────────

/**
 * 获取宠物状态，含实时心情计算，Redis 缓存 10 分钟。
 *
 * @param userId 用户 ID
 * @returns 宠物状态
 */
export async function getPetStatus(userId: number): Promise<PetStatusResult> {
  // 1. 尝试读取 Redis 缓存
  const cached = await redis.get(petStatusCacheKey(userId)).catch(() => null);
  if (cached) {
    try {
      return JSON.parse(cached) as PetStatusResult;
    } catch {
      // 缓存损坏，继续从 DB 读取
    }
  }

  // 2. 获取或创建宠物记录
  const pet = await prisma.pet.upsert({
    where: { userId },
    create: { userId, name: '小R', satiety: 0 },
    update: {},
  });

  // 3. 获取游戏化状态（等级/XP/HP/Streak）
  const gamStatus = await prisma.gamificationStatus.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  // 4. 获取用户档案（每日卡路里目标）
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const dailyTarget = profile?.dailyCalTarget ?? 2000;

  // 5. 获取今日饮食记录（计算 totalCalories 和 mealCount）
  const today = toDateString(new Date());
  const dayStart = new Date(`${today}T00:00:00.000Z`);
  const dayEnd = new Date(`${today}T23:59:59.999Z`);

  const todayRecords = await prisma.foodRecord.findMany({
    where: {
      userId,
      recordedAt: { gte: dayStart, lte: dayEnd },
    },
    select: { calories: true, mealType: true },
  });

  const totalCalories = todayRecords.reduce((sum, r) => sum + r.calories, 0);
  // 按餐次去重计算 mealCount
  const uniqueMealTypes = new Set(todayRecords.map(r => r.mealType));
  const mealCount = uniqueMealTypes.size;

  // 6. 计算心情
  const mood = calcPetMood({
    totalCalories,
    dailyTarget,
    mealCount,
    streakDays: gamStatus.streakDays,
  });

  const result: PetStatusResult = {
    id: pet.id,
    name: pet.name,
    satiety: pet.satiety,
    mood,
    hatSlot: pet.hatSlot,
    clothSlot: pet.clothSlot,
    accessSlot: pet.accessSlot,
    level: gamStatus.level,
    totalXp: gamStatus.totalXp,
  };

  // 7. 写入 Redis 缓存
  await redis
    .set(
      petStatusCacheKey(userId),
      JSON.stringify(result),
      'EX',
      PET_STATUS_TTL
    )
    .catch(() => null);

  logger.debug('pet.service: status fetched', { userId, mood });

  return result;
}

/**
 * 与宠物互动，授予 +10 XP，每日幂等（每日一次）。
 *
 * @param userId 用户 ID
 * @returns 互动结果
 */
export async function interactWithPet(userId: number): Promise<InteractResult> {
  const today = toDateString(new Date());
  const interactKey = petInteractCacheKey(userId, today);

  // 1. 检查今日是否已互动
  const alreadyDone = await redis.get(interactKey).catch(() => null);
  if (alreadyDone) {
    logger.debug('pet.service: interact already done today', { userId, today });
    return { alreadyInteracted: true, xpAwarded: 0 };
  }

  // 2. 授予 XP (+10)，幂等 refId = `pet_interact_{userId}_{date}`
  const refId = `pet_interact_${userId}_${today}`;
  await awardXp(userId, 'pet_interact', refId, 10);

  // 3. 设置今日互动标记（TTL = 距次日零点的秒数）
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttl = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
  await redis.set(interactKey, '1', 'EX', ttl).catch(() => null);

  // 4. 失效宠物状态缓存
  await redis.del(petStatusCacheKey(userId)).catch(() => null);

  logger.info('pet.service: interact awarded', { userId, today });

  return { alreadyInteracted: false, xpAwarded: 10 };
}

/**
 * 更新宠物装扮槽位数据。
 *
 * @param userId 用户 ID
 * @param outfit 装扮槽位数据
 * @returns 更新后的宠物记录
 */
export async function updatePetOutfit(
  userId: number,
  outfit: PetOutfitInput
): Promise<PetStatusResult> {
  // 1. 确保宠物记录存在
  await prisma.pet.upsert({
    where: { userId },
    create: { userId, name: '小R', satiety: 0 },
    update: {},
  });

  // 2. 构建更新数据（只更新传入的字段）
  const updateData: {
    hatSlot?: string | null;
    clothSlot?: string | null;
    accessSlot?: string | null;
  } = {};

  if (outfit.hat !== undefined) updateData.hatSlot = outfit.hat;
  if (outfit.clothes !== undefined) updateData.clothSlot = outfit.clothes;
  if (outfit.accessory !== undefined) updateData.accessSlot = outfit.accessory;

  await prisma.pet.update({
    where: { userId },
    data: updateData,
  });

  // 3. 失效宠物状态缓存
  await redis.del(petStatusCacheKey(userId)).catch(() => null);

  logger.info('pet.service: outfit updated', { userId, outfit });

  // 4. 返回最新状态
  return getPetStatus(userId);
}

/**
 * 获取用户已解锁的装扮 key 列表。
 * 通过 PetLevelHistory 中的 unlockedItem 字段获取。
 *
 * @param userId 用户 ID
 * @returns 已解锁装扮 key 列表
 */
export async function getUnlockedOutfits(userId: number): Promise<string[]> {
  const pet = await prisma.pet.findUnique({ where: { userId } });
  if (!pet) return [];

  const levelHistory = await prisma.petLevelHistory.findMany({
    where: {
      petId: pet.id,
      unlockedItem: { not: null },
    },
    select: { unlockedItem: true },
  });

  return levelHistory
    .map(h => h.unlockedItem)
    .filter((item): item is string => item !== null);
}
