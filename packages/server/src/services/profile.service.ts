import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import {
  calcDailyCalorieTarget,
  type CalorieCalculatorParams,
} from '@/utils/calorieCalculator';

// ─── 类型 ────────────────────────────────────────────────────────────────────

/** 个人资料（对外暴露） */
export interface ProfileResult {
  id: number;
  userId: number;
  nickname: string;
  gender: string;
  height: number;
  weight: number;
  age: number;
  goal: string;
  activityLevel: string;
  dailyCalTarget: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 更新个人资料入参 */
export interface UpdateProfileInput {
  nickname?: string;
  gender?: string;
  height?: number;
  weight?: number;
  age?: number;
  goal?: string;
  activityLevel?: string;
}

/** 体重记录（对外暴露） */
export interface WeightRecordResult {
  id: number;
  weight: number;
  recordedAt: Date;
}

// ─── 缓存键 ──────────────────────────────────────────────────────────────────

const PROFILE_CACHE_TTL = 5 * 60; // 5 分钟

function profileCacheKey(userId: number): string {
  return `user:profile:${userId}`;
}

// ─── 服务函数 ─────────────────────────────────────────────────────────────────

/**
 * 获取用户个人资料，优先读取 Redis 缓存（TTL 5 分钟）。
 *
 * @param userId 用户 ID
 * @returns 个人资料，若不存在则返回 null
 */
export async function getProfile(
  userId: number
): Promise<ProfileResult | null> {
  // 1. 尝试读取 Redis 缓存
  const cached = await redis.get(profileCacheKey(userId)).catch(() => null);
  if (cached) {
    try {
      return JSON.parse(cached) as ProfileResult;
    } catch {
      // 缓存损坏，继续从 DB 读取
    }
  }

  // 2. 从 DB 读取
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    return null;
  }

  const result: ProfileResult = {
    id: profile.id,
    userId: profile.userId,
    nickname: profile.nickname,
    gender: profile.gender,
    height: profile.height,
    weight: profile.weight,
    age: profile.age,
    goal: profile.goal,
    activityLevel: profile.activityLevel,
    dailyCalTarget: profile.dailyCalTarget,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  // 3. 写入 Redis 缓存
  await redis
    .set(
      profileCacheKey(userId),
      JSON.stringify(result),
      'EX',
      PROFILE_CACHE_TTL
    )
    .catch(() => null);

  logger.debug('profile.service: profile fetched', { userId });

  return result;
}

/**
 * 更新用户个人资料，并触发每日卡路里目标重算。
 *
 * @param userId 用户 ID
 * @param data   更新数据
 * @returns 更新后的个人资料
 */
export async function updateProfile(
  userId: number,
  data: UpdateProfileInput
): Promise<ProfileResult> {
  // 1. 获取当前档案（用于填充重算所需的完整字段）
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (!existing) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  // 2. 合并更新字段
  const merged = {
    nickname: data.nickname ?? existing.nickname,
    gender: data.gender ?? existing.gender,
    height: data.height ?? existing.height,
    weight: data.weight ?? existing.weight,
    age: data.age ?? existing.age,
    goal: data.goal ?? existing.goal,
    activityLevel: data.activityLevel ?? existing.activityLevel,
  };

  // 3. 重算每日卡路里目标（Property 27：相同输入始终相同输出）
  const calcParams: CalorieCalculatorParams = {
    gender: merged.gender as 'male' | 'female',
    weight: merged.weight,
    height: merged.height,
    age: merged.age,
    activityLevel:
      merged.activityLevel as CalorieCalculatorParams['activityLevel'],
    goal: merged.goal as CalorieCalculatorParams['goal'],
  };
  const newDailyCalTarget = calcDailyCalorieTarget(calcParams);

  // 4. 写入 DB
  const updated = await prisma.userProfile.update({
    where: { userId },
    data: {
      ...merged,
      dailyCalTarget: newDailyCalTarget,
    },
  });

  // 5. 失效 Redis 缓存
  await redis.del(profileCacheKey(userId)).catch(() => null);

  logger.info('profile.service: profile updated', {
    userId,
    newDailyCalTarget,
  });

  return {
    id: updated.id,
    userId: updated.userId,
    nickname: updated.nickname,
    gender: updated.gender,
    height: updated.height,
    weight: updated.weight,
    age: updated.age,
    goal: updated.goal,
    activityLevel: updated.activityLevel,
    dailyCalTarget: updated.dailyCalTarget,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * 记录用户新体重，同时更新档案中的当前体重并触发卡路里目标重算。
 *
 * @param userId 用户 ID
 * @param weight 新体重（kg）
 * @returns 新建的体重记录
 */
export async function recordWeight(
  userId: number,
  weight: number
): Promise<WeightRecordResult> {
  // 1. 写入体重历史
  const record = await prisma.weightRecord.create({
    data: { userId, weight },
  });

  // 2. 同步更新档案中的体重并重算卡路里目标
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (existing) {
    const calcParams: CalorieCalculatorParams = {
      gender: existing.gender as 'male' | 'female',
      weight,
      height: existing.height,
      age: existing.age,
      activityLevel:
        existing.activityLevel as CalorieCalculatorParams['activityLevel'],
      goal: existing.goal as CalorieCalculatorParams['goal'],
    };
    const newDailyCalTarget = calcDailyCalorieTarget(calcParams);

    await prisma.userProfile.update({
      where: { userId },
      data: { weight, dailyCalTarget: newDailyCalTarget },
    });

    // 失效 Redis 缓存
    await redis.del(profileCacheKey(userId)).catch(() => null);

    logger.info('profile.service: weight recorded and profile updated', {
      userId,
      weight,
      newDailyCalTarget,
    });
  }

  return {
    id: record.id,
    weight: record.weight,
    recordedAt: record.recordedAt,
  };
}

/**
 * 获取用户全部体重历史，按时间降序排列。
 *
 * @param userId 用户 ID
 * @returns 体重记录列表（降序）
 */
export async function getWeightHistory(
  userId: number
): Promise<WeightRecordResult[]> {
  const records = await prisma.weightRecord.findMany({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
  });

  return records.map(r => ({
    id: r.id,
    weight: r.weight,
    recordedAt: r.recordedAt,
  }));
}
