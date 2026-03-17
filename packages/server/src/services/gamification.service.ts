import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import { calcLevel, xpToNextLevel } from '@/utils/gamificationEngine';

// ─── 类型 ────────────────────────────────────────────────────────────────────

/** 对外暴露的游戏化状态 */
export interface GamificationStatusResult {
  totalXp: number;
  level: number;
  weeklyXp: number;
  currentHp: number;
  streakDays: number;
  streakShields: number;
  xpToNextLevel: number;
  levelProgress: number; // 0.0–1.0
  lastCheckinAt: Date | null;
}

/** XP 流水记录（对外暴露） */
export interface XpTransactionItem {
  id: number;
  amount: number;
  reason: string;
  refId: string | null;
  earnedAt: Date;
}

// ─── 缓存键 ──────────────────────────────────────────────────────────────────

const CACHE_TTL = 5 * 60; // 5 分钟

function cacheKey(userId: number): string {
  return `user:gamification:${userId}`;
}

// ─── 服务函数 ─────────────────────────────────────────────────────────────────

/**
 * 获取用户游戏化状态，优先读取 Redis 缓存（TTL 5 分钟）。
 *
 * @param userId 用户 ID
 * @returns 游戏化状态
 */
export async function getGamificationStatus(
  userId: number
): Promise<GamificationStatusResult> {
  // 1. 尝试读取 Redis 缓存
  const cached = await redis.get(cacheKey(userId)).catch(() => null);
  if (cached) {
    try {
      return JSON.parse(cached) as GamificationStatusResult;
    } catch {
      // 缓存损坏，继续从 DB 读取
    }
  }

  // 2. 从 DB 读取（若不存在则 upsert 初始状态）
  const status = await prisma.gamificationStatus.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const currentLevel = calcLevel(status.totalXp);
  const remaining = xpToNextLevel(status.totalXp);

  // 计算当前等级进度（当前等级起始 XP 到下一级所需 XP 的比例）
  const currentLevelStartXp = 100 * (currentLevel - 1) ** 2;
  const nextLevelXp =
    currentLevel < 50 ? 100 * currentLevel ** 2 : 100 * 50 ** 2;
  const levelRangeXp = nextLevelXp - currentLevelStartXp;
  const earnedInLevel = status.totalXp - currentLevelStartXp;
  const levelProgress =
    levelRangeXp > 0
      ? Math.min(1, Math.max(0, earnedInLevel / levelRangeXp))
      : 1;

  const result: GamificationStatusResult = {
    totalXp: status.totalXp,
    level: currentLevel,
    weeklyXp: status.weeklyXp,
    currentHp: status.currentHp,
    streakDays: status.streakDays,
    streakShields: status.streakShields,
    xpToNextLevel: remaining,
    levelProgress,
    lastCheckinAt: status.lastCheckinAt,
  };

  // 3. 写入 Redis 缓存
  await redis
    .set(cacheKey(userId), JSON.stringify(result), 'EX', CACHE_TTL)
    .catch(() => null);

  logger.debug('gamification.service: status fetched', {
    userId,
    level: currentLevel,
  });

  return result;
}

/**
 * 获取用户 XP 流水历史（最近 50 条，按时间倒序）。
 *
 * @param userId 用户 ID
 * @returns XP 流水列表
 */
export async function getXpHistory(
  userId: number
): Promise<XpTransactionItem[]> {
  const transactions = await prisma.xpTransaction.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
    take: 50,
  });

  return transactions.map(t => ({
    id: t.id,
    amount: t.amount,
    reason: t.reason,
    refId: t.refId,
    earnedAt: t.earnedAt,
  }));
}
