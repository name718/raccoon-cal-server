import { logger } from '@/utils/logger';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** XP 授予规则 */
export const XP_RULES = {
  food_record: 10,
  daily_goal: 30,
  task_complete: (xp: number) => xp,
  streak_bonus: (streak: number) => Math.min(5 * streak, 50),
  achievement: (xp: number) => xp,
} as const;

/** 最大等级 */
export const MAX_LEVEL = 50;

/** 最大 HP */
export const MAX_HP = 5;

// ─── 类型 ────────────────────────────────────────────────────────────────────

/** 浣熊心情枚举 */
export type PetMood =
  | 'happy'
  | 'satisfied'
  | 'normal'
  | 'hungry'
  | 'sad'
  | 'missing';

/** calcPetMood 入参 */
export interface PetMoodParams {
  totalCalories: number;
  dailyTarget: number;
  mealCount: number;
  streakDays: number;
}

// ─── 纯函数（无副作用） ───────────────────────────────────────────────────────

/**
 * 根据累计 XP 计算当前等级。
 * 等级公式：Level N 所需累计 XP = 100 × N²，上限 50 级。
 *
 * @param _totalXp 累计总 XP（≥ 0）
 * @returns 当前等级（1–50）
 */
export function calcLevel(totalXp: number): number {
  // Level N requires cumulative XP of 100 × N²
  // Find the highest N where 100 × N² ≤ totalXp, capped at MAX_LEVEL (50)
  const level = Math.floor(Math.sqrt(Math.max(0, totalXp) / 100));
  return Math.min(Math.max(level, 1), MAX_LEVEL);
}

/**
 * 计算升到下一级还需要多少 XP。
 * 已满级（50 级）时返回 0。
 *
 * @param _totalXp 累计总 XP（≥ 0）
 * @returns 距下一级所需 XP
 */
export function xpToNextLevel(totalXp: number): number {
  const currentLevel = calcLevel(totalXp);
  if (currentLevel >= MAX_LEVEL) return 0;
  const nextLevelXp = 100 * (currentLevel + 1) ** 2;
  return nextLevelXp - Math.max(0, totalXp);
}

/**
 * 计算浣熊心情状态（纯函数，确定性）。
 *
 * 规则：
 * - streakDays === 0 且 mealCount === 0 → 'missing'（连续 3 天未打卡）
 * - totalCalories > dailyTarget × 1.2 → 'sad'
 * - totalCalories ∈ [dailyTarget × 0.9, dailyTarget × 1.1] → 'happy'
 * - mealCount ≥ 2 → 'satisfied'
 * - mealCount === 1 → 'normal'
 * - 其他 → 'hungry'
 *
 * @param _params 当日行为数据
 * @returns 心情状态
 */
export function calcPetMood(params: PetMoodParams): PetMood {
  const { totalCalories, dailyTarget, mealCount, streakDays } = params;

  // 连续 3 天未打卡（streakDays === 0 且 mealCount === 0）
  if (streakDays === 0 && mealCount === 0) return 'missing';

  // 超出目标 20% → 难过
  if (totalCalories > dailyTarget * 1.2) return 'sad';

  // 达标 90%-110% → 开心

  if (totalCalories >= dailyTarget * 0.9 && totalCalories <= dailyTarget * 1.1)
    return 'happy';

  // 记录 ≥ 2 餐 → 满足
  if (mealCount >= 2) return 'satisfied';

  // 记录 1 餐 → 正常
  if (mealCount === 1) return 'normal';

  // 其他（无记录）→ 饥饿
  return 'hungry';
}

/**
 * 计算本次饮食记录带来的饱食度增量。
 * 增量 = min(recordCalories / dailyTarget × 100, 100)
 *
 * @param _recordCalories 本次记录的卡路里
 * @param _dailyTarget    每日卡路里目标
 * @returns 饱食度增量（0–100）
 */
export function calcSatietyDelta(
  recordCalories: number,
  dailyTarget: number
): number {
  if (dailyTarget <= 0) return 0;
  return Math.min((recordCalories / dailyTarget) * 100, 100);
}

// ─── 异步函数（含 DB / Redis 副作用） ────────────────────────────────────────

/**
 * 幂等地为用户授予 XP。
 *
 * 流程：
 * 1. 查询 Redis 去重缓存，命中则跳过
 * 2. 写入 XpTransaction（DB 唯一约束兜底）
 * 3. 更新 GamificationStatus.totalXp 和 weeklyXp
 * 4. 检查是否升级，若升级则写 PetLevelHistory
 * 5. 更新 Redis Sorted Set（联盟排行榜）
 *
 * @param userId 用户 ID
 * @param reason XP 来源（food_record / daily_goal / task / streak / achievement）
 * @param refId  关联业务 ID，用于幂等去重
 * @param amount 授予 XP 数量
 */
export async function awardXp(
  userId: number,
  reason: string,
  refId: string,
  amount: number
): Promise<void> {
  // 1. Redis 去重缓存（24h TTL）
  const dedupKey = `user:xp_dedup:${userId}:${reason}:${refId}`;
  const alreadyAwarded = await redis.get(dedupKey).catch(() => null);
  if (alreadyAwarded) {
    logger.debug('awardXp: skipped (Redis dedup hit)', {
      userId,
      reason,
      refId,
    });
    return;
  }

  // 2. 写入 XpTransaction（DB 唯一约束兜底幂等）
  try {
    await prisma.xpTransaction.create({
      data: { userId, amount, reason, refId },
    });
  } catch (err: unknown) {
    // Prisma unique constraint violation code: P2002
    if ((err as { code?: string }).code === 'P2002') {
      logger.debug('awardXp: skipped (DB unique constraint)', {
        userId,
        reason,
        refId,
      });
      // Still set Redis key so future calls are fast
      await redis.set(dedupKey, '1', 'EX', 86400).catch(() => null);
      return;
    }
    throw err;
  }

  // Set Redis dedup key after successful DB write
  await redis.set(dedupKey, '1', 'EX', 86400).catch(() => null);

  // 3. 更新 GamificationStatus（upsert 保证首次也能创建）
  const status = await prisma.gamificationStatus.upsert({
    where: { userId },
    create: {
      userId,
      totalXp: amount,
      weeklyXp: amount,
      level: calcLevel(amount),
    },
    update: {
      totalXp: { increment: amount },
      weeklyXp: { increment: amount },
    },
  });

  const newTotalXp = status.totalXp;
  const newLevel = calcLevel(newTotalXp);

  // 4. 检查是否升级，若升级则写 PetLevelHistory
  if (newLevel > status.level) {
    await prisma.gamificationStatus.update({
      where: { userId },
      data: { level: newLevel },
    });

    const pet = await prisma.pet.findUnique({ where: { userId } });
    if (pet) {
      await prisma.petLevelHistory.create({
        data: { petId: pet.id, level: newLevel },
      });
    }

    logger.info('awardXp: level up', {
      userId,
      oldLevel: status.level,
      newLevel,
    });
  }

  // 5. 更新 Redis Sorted Set（联盟排行榜）
  // 获取用户当前联盟信息以确定 tier 和 weekStart
  const leagueMember = await prisma.leagueMember.findFirst({
    where: { userId },
    include: { league: true },
    orderBy: { id: 'desc' },
  });

  if (leagueMember) {
    const rankingKey = `league:ranking:${leagueMember.league.tier}:${leagueMember.league.weekStart}`;
    await redis.zincrby(rankingKey, amount, String(userId)).catch(() => null);
  }

  // 失效游戏化状态缓存
  await redis.del(`user:gamification:${userId}`).catch(() => null);

  logger.info('awardXp: awarded', {
    userId,
    reason,
    refId,
    amount,
    newTotalXp,
  });
}

/**
 * 检查当日卡路里是否超标，超标时扣减 1 点 HP（下限 0）。
 *
 * 触发条件：totalCalories > dailyTarget × 1.1 且 currentHp > 0
 *
 * @param userId 用户 ID
 * @param date   日期字符串（YYYY-MM-DD）
 */
export async function checkAndDeductHp(
  userId: number,
  date: string
): Promise<void> {
  // 1. 获取用户每日卡路里目标
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    logger.warn('checkAndDeductHp: no profile found', { userId });
    return;
  }

  // 2. 汇总当日卡路里摄入
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const agg = await prisma.foodRecord.aggregate({
    where: {
      userId,
      recordedAt: { gte: dayStart, lte: dayEnd },
    },
    _sum: { calories: true },
  });

  const totalCalories = agg._sum.calories ?? 0;
  const threshold = profile.dailyCalTarget * 1.1;

  // 3. 未超标则不扣 HP
  if (totalCalories <= threshold) {
    logger.debug('checkAndDeductHp: within target, no HP deducted', {
      userId,
      date,
      totalCalories,
      threshold,
    });
    return;
  }

  // 4. 超标：扣减 1 点 HP，下限 0
  const status = await prisma.gamificationStatus.findUnique({
    where: { userId },
  });
  if (!status || status.currentHp <= 0) {
    logger.debug('checkAndDeductHp: HP already 0, skipping', { userId, date });
    return;
  }

  const newHp = Math.max(0, status.currentHp - 1);
  await prisma.gamificationStatus.update({
    where: { userId },
    data: { currentHp: newHp },
  });

  // 5. 失效游戏化状态缓存
  await redis.del(`user:gamification:${userId}`).catch(() => null);

  logger.info('checkAndDeductHp: HP deducted', {
    userId,
    date,
    totalCalories,
    threshold,
    oldHp: status.currentHp,
    newHp,
  });
}
