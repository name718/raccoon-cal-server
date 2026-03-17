import cron from 'node-cron';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** 晋升/降级比例（前/后 20%） */
const SETTLEMENT_RATIO = 0.2;

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 获取本周开始日期（周一，YYYY-MM-DD，UTC） */
function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/** 联盟排行榜 Redis key */
function rankingKey(leagueId: number): string {
  return `league:${leagueId}:weekly_xp`;
}

// ─── 核心逻辑 ─────────────────────────────────────────────────────────────────

/**
 * 对单个联盟执行结算：
 * 1. 按 weeklyXp 降序排列成员
 * 2. 前 ceil(N * 0.2) 名标记晋升
 * 3. 后 ceil(N * 0.2) 名标记降级
 * 4. 写入 LeagueMember.rank 和 LeagueMember.promoted
 */
async function settleLeague(leagueId: number): Promise<void> {
  // 从 Redis Sorted Set 获取所有成员（降序）
  const rawMembers = await redis
    .zrevrange(rankingKey(leagueId), 0, -1, 'WITHSCORES')
    .catch(() => [] as string[]);

  let rankedUserIds: Array<{ userId: number; weeklyXp: number }> = [];

  if (rawMembers.length > 0) {
    for (let i = 0; i < rawMembers.length; i += 2) {
      rankedUserIds.push({
        userId: parseInt(rawMembers[i], 10),
        weeklyXp: Math.round(parseFloat(rawMembers[i + 1])),
      });
    }
  } else {
    // Redis 为空，从 DB 回退
    const dbMembers = await prisma.leagueMember.findMany({
      where: { leagueId },
      orderBy: { weeklyXp: 'desc' },
    });
    rankedUserIds = dbMembers.map(m => ({
      userId: m.userId,
      weeklyXp: m.weeklyXp,
    }));
  }

  const total = rankedUserIds.length;
  if (total === 0) return;

  const promoteCount = Math.ceil(total * SETTLEMENT_RATIO);
  const demoteCount = Math.ceil(total * SETTLEMENT_RATIO);

  // 批量更新 LeagueMember 的 rank 和 promoted 字段
  await Promise.all(
    rankedUserIds.map(async ({ userId }, idx) => {
      const rank = idx + 1;
      let promoted: boolean | null = null;

      if (rank <= promoteCount) {
        promoted = true; // 晋升
      } else if (rank > total - demoteCount) {
        promoted = false; // 降级
      }

      await prisma.leagueMember.updateMany({
        where: { leagueId, userId },
        data: { rank, promoted },
      });
    })
  );

  logger.info('leagueSettlement: league settled', {
    leagueId,
    total,
    promoteCount,
    demoteCount,
  });
}

// ─── 主任务函数 ───────────────────────────────────────────────────────────────

/**
 * 联盟结算主函数。
 * 查询本周所有联盟，逐一执行晋升/降级结算，单个联盟失败不影响其他联盟。
 */
async function runLeagueSettlement(): Promise<void> {
  const weekStart = getCurrentWeekStart();
  logger.info('leagueSettlement: job started', { weekStart });

  const leagues = await prisma.league.findMany({
    where: { weekStart },
    select: { id: true, tier: true },
  });

  logger.info('leagueSettlement: processing leagues', {
    count: leagues.length,
    weekStart,
  });

  let successCount = 0;
  let errorCount = 0;

  for (const league of leagues) {
    try {
      await settleLeague(league.id);
      successCount++;
    } catch (err) {
      errorCount++;
      logger.error('leagueSettlement: error settling league', {
        leagueId: league.id,
        tier: league.tier,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('leagueSettlement: job completed', {
    weekStart,
    successCount,
    errorCount,
    total: leagues.length,
  });
}

// ─── 注册函数 ─────────────────────────────────────────────────────────────────

/**
 * 注册每周日 23:59 联盟结算 cron 任务。
 * 在 `startServer()` 中调用此函数以启动定时任务。
 */
export function registerLeagueSettlementJob(): void {
  // 每周日 23:59 执行（UTC）
  cron.schedule('59 23 * * 0', async () => {
    try {
      await runLeagueSettlement();
    } catch (err) {
      logger.error('leagueSettlement: unhandled error in cron job', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info('leagueSettlement: cron job registered (59 23 * * 0)');
}
