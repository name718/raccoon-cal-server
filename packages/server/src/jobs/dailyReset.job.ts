import cron from 'node-cron';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import { generateDailyTasks } from '@/services/task.service';

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** 每日重置 HP 值 */
const RESET_HP = 5;

/** 每日重置饱食度 */
const RESET_SATIETY = 0;

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 将 Date 格式化为 YYYY-MM-DD 字符串（UTC） */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 获取昨日日期字符串（UTC） */
function getYesterdayString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return toDateString(d);
}

// ─── 核心逻辑 ─────────────────────────────────────────────────────────────────

/**
 * 检查用户昨日是否有饮食记录（打卡）。
 */
async function hasCheckinOnDate(
  userId: number,
  date: string
): Promise<boolean> {
  // 先查 Redis 打卡标记
  const flagKey = `checkin:flag:${userId}:${date}`;
  const cached = await redis.get(flagKey).catch(() => null);
  if (cached) return true;

  // 回退到 DB 查询
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);

  const count = await prisma.foodRecord.count({
    where: {
      userId,
      recordedAt: { gte: dayStart, lte: dayEnd },
    },
  });

  return count > 0;
}

/**
 * 为单个用户执行每日重置逻辑：
 * 1. 重置 HP 为 5
 * 2. 重置宠物饱食度为 0
 * 3. 生成今日每日任务
 * 4. 检查 Streak（昨日未打卡则扣减或消耗保护盾）
 */
async function resetUserDaily(userId: number, today: string): Promise<void> {
  const yesterday = getYesterdayString();

  // 1. 重置 HP
  await prisma.gamificationStatus.upsert({
    where: { userId },
    create: { userId, currentHp: RESET_HP, hpResetAt: new Date() },
    update: { currentHp: RESET_HP, hpResetAt: new Date() },
  });

  // 2. 重置宠物饱食度
  await prisma.pet.upsert({
    where: { userId },
    create: { userId, name: '小R', satiety: RESET_SATIETY },
    update: { satiety: RESET_SATIETY },
  });

  // 3. 生成今日每日任务（generateDailyTasks 内部有幂等保护）
  await generateDailyTasks(userId, today);

  // 4. 检查 Streak
  const checkedIn = await hasCheckinOnDate(userId, yesterday);

  if (!checkedIn) {
    const status = await prisma.gamificationStatus.findUnique({
      where: { userId },
    });

    if (status && status.streakDays > 0) {
      if (status.streakShields > 0) {
        // 消耗一个保护盾，Streak 保持不变
        await prisma.gamificationStatus.update({
          where: { userId },
          data: { streakShields: status.streakShields - 1 },
        });
        logger.info('dailyReset: shield consumed', {
          userId,
          streakDays: status.streakDays,
          remainingShields: status.streakShields - 1,
        });
      } else {
        // 无保护盾，重置 Streak 为 0
        await prisma.gamificationStatus.update({
          where: { userId },
          data: { streakDays: 0 },
        });
        logger.info('dailyReset: streak reset', {
          userId,
          previousStreak: status.streakDays,
        });
      }
    }
  }

  // 5. 失效相关 Redis 缓存
  await Promise.all([
    redis.del(`user:gamification:${userId}`).catch(() => null),
    redis.del(`pet:status:${userId}`).catch(() => null),
    redis.del(`user:daily_tasks:${userId}:${today}`).catch(() => null),
  ]);
}

// ─── 主任务函数 ───────────────────────────────────────────────────────────────

/**
 * 每日零点重置任务主函数。
 * 遍历所有活跃用户，逐一执行重置逻辑，单个用户失败不影响其他用户。
 */
async function runDailyReset(): Promise<void> {
  const today = toDateString(new Date());
  logger.info('dailyReset: job started', { today });

  // 获取所有活跃用户 ID
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  logger.info('dailyReset: processing users', { count: users.length, today });

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      await resetUserDaily(user.id, today);
      successCount++;
    } catch (err) {
      errorCount++;
      logger.error('dailyReset: error processing user', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('dailyReset: job completed', {
    today,
    successCount,
    errorCount,
    total: users.length,
  });
}

// ─── 注册函数 ─────────────────────────────────────────────────────────────────

/**
 * 注册每日零点重置 cron 任务。
 * 在 `startServer()` 中调用此函数以启动定时任务。
 */
export function registerDailyResetJob(): void {
  // 每日 00:00 执行（UTC）
  cron.schedule('0 0 * * *', async () => {
    try {
      await runDailyReset();
    } catch (err) {
      logger.error('dailyReset: unhandled error in cron job', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info('dailyReset: cron job registered (0 0 * * *)');
}
