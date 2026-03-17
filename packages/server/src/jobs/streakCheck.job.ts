import cron from 'node-cron';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** Redis key 前缀：streak 风险状态 */
const STREAK_RISK_PREFIX = 'streak:risk:';

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 将 Date 格式化为 YYYY-MM-DD 字符串（UTC） */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 计算距今日 23:59:59 UTC 的剩余秒数（用于 Redis TTL） */
function secondsUntilEndOfDay(): number {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return Math.max(1, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
}

// ─── 核心逻辑 ─────────────────────────────────────────────────────────────────

/**
 * 查询今日尚未打卡且 streakDays > 0 的用户，
 * 在 Redis 中写入 streak:risk:{userId} 标记，TTL 至当日结束。
 */
async function runStreakCheck(): Promise<void> {
  const today = toDateString(new Date());
  logger.info('streakCheck: job started', { today });

  // 今日时间范围（UTC）
  const dayStart = new Date(`${today}T00:00:00.000Z`);
  const dayEnd = new Date(`${today}T23:59:59.999Z`);

  // 查询今日已打卡的用户 ID 集合
  const checkedInRecords = await prisma.foodRecord.findMany({
    where: {
      recordedAt: { gte: dayStart, lte: dayEnd },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  const checkedInUserIds = new Set(checkedInRecords.map(r => r.userId));

  // 查询有活跃 streak（streakDays > 0）的用户
  const atRiskStatuses = await prisma.gamificationStatus.findMany({
    where: {
      streakDays: { gt: 0 },
      user: { isActive: true },
    },
    select: { userId: true, streakDays: true },
  });

  // 过滤出今日未打卡的用户
  const atRiskUsers = atRiskStatuses.filter(
    s => !checkedInUserIds.has(s.userId)
  );

  logger.info('streakCheck: at-risk users identified', {
    today,
    totalWithStreak: atRiskStatuses.length,
    checkedInToday: checkedInUserIds.size,
    atRiskCount: atRiskUsers.length,
  });

  const ttl = secondsUntilEndOfDay();
  let successCount = 0;
  let errorCount = 0;

  for (const { userId, streakDays } of atRiskUsers) {
    try {
      // 先检查 Redis 打卡标记（与 dailyReset 保持一致）
      const flagKey = `checkin:flag:${userId}:${today}`;
      const cached = await redis.get(flagKey).catch(() => null);

      if (cached) {
        // 用户已通过 Redis 标记打卡，跳过
        continue;
      }

      const riskKey = `${STREAK_RISK_PREFIX}${userId}`;
      await redis.setex(riskKey, ttl, streakDays.toString());
      successCount++;

      logger.debug('streakCheck: risk flag set', { userId, streakDays, ttl });
    } catch (err) {
      errorCount++;
      logger.error('streakCheck: error setting risk flag', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('streakCheck: job completed', {
    today,
    successCount,
    errorCount,
    ttl,
  });
}

// ─── 注册函数 ─────────────────────────────────────────────────────────────────

/**
 * 注册每日 19:00 streak 风险检查 cron 任务。
 * 在 `startServer()` 中调用此函数以启动定时任务。
 */
export function registerStreakCheckJob(): void {
  // 每日 19:00 执行（UTC）
  cron.schedule('0 19 * * *', async () => {
    try {
      await runStreakCheck();
    } catch (err) {
      logger.error('streakCheck: unhandled error in cron job', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info('streakCheck: cron job registered (0 19 * * *)');
}
