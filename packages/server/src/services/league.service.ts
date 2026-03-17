import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import { calcLevel, calcPetMood } from '@/utils/gamificationEngine';

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** 联盟层级定义（按等级区间分配） */
const TIER_RULES: Array<{ tier: string; minLevel: number; maxLevel: number }> =
  [
    { tier: 'bronze', minLevel: 1, maxLevel: 10 },
    { tier: 'silver', minLevel: 11, maxLevel: 20 },
    { tier: 'gold', minLevel: 21, maxLevel: 30 },
    { tier: 'platinum', minLevel: 31, maxLevel: 40 },
    { tier: 'diamond', minLevel: 41, maxLevel: 50 },
  ];

/** 每个联盟分组最大成员数 */
const MAX_LEAGUE_SIZE = 30;

/** 排行榜 Top N */
const LEADERBOARD_TOP_N = 10;

/** 联盟排行榜 Redis 缓存 TTL（7 天） */
const LEAGUE_RANKING_TTL = 7 * 24 * 60 * 60;

// ─── 类型 ────────────────────────────────────────────────────────────────────

export interface LeagueMemberResult {
  userId: string;
  nickname: string;
  petAvatarMood: string;
  weeklyXp: number;
  rank: number;
}

export interface LeagueInfoResult {
  leagueId: number;
  leagueName: string;
  tier: string;
  userRank: number;
  userWeeklyXp: number;
  topMembers: LeagueMemberResult[];
  totalMembers: number;
}

export interface LeagueSettlementResult {
  promoted: boolean | null;
  demoted: boolean | null;
  newTier: string;
  finalRank: number;
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 根据等级确定联盟层级。
 */
function getTierByLevel(level: number): string {
  for (const rule of TIER_RULES) {
    if (level >= rule.minLevel && level <= rule.maxLevel) return rule.tier;
  }
  return 'bronze';
}

/**
 * 获取本周开始日期（周一，YYYY-MM-DD）。
 */
function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sunday
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/**
 * 联盟排行榜 Redis key（基于 leagueId）。
 */
function rankingKey(leagueId: number): string {
  return `league:${leagueId}:weekly_xp`;
}

// ─── 服务函数 ─────────────────────────────────────────────────────────────────

/**
 * 为用户分配联盟（若尚未加入本周联盟）。
 * 按等级分配层级，每组上限 30 人，满员则自动创建新分组。
 *
 * @param userId 用户 ID
 * @returns 联盟成员记录 ID
 */
export async function assignLeague(userId: number): Promise<number> {
  const weekStart = getCurrentWeekStart();

  // 检查用户是否已在本周联盟中
  const existing = await prisma.leagueMember.findFirst({
    where: { userId },
    include: { league: true },
    orderBy: { id: 'desc' },
  });
  if (existing && existing.league.weekStart === weekStart) {
    return existing.id;
  }

  // 获取用户等级以确定 tier
  const status = await prisma.gamificationStatus.findUnique({
    where: { userId },
  });
  const level = calcLevel(status?.totalXp ?? 0);
  const tier = getTierByLevel(level);

  // 查找本周该 tier 中有空位的联盟
  let leagueId: number;

  const leagueWithSpace = await prisma.league.findFirst({
    where: { tier, weekStart },
    include: { _count: { select: { members: true } } },
    orderBy: { id: 'asc' },
  });

  if (leagueWithSpace && leagueWithSpace._count.members < MAX_LEAGUE_SIZE) {
    leagueId = leagueWithSpace.id;
  } else {
    // 创建新联盟分组
    const newLeague = await prisma.league.create({
      data: { tier, weekStart },
    });
    leagueId = newLeague.id;
    logger.info('league.service: new league created', {
      tier,
      weekStart,
      leagueId,
    });
  }

  // 加入联盟
  const member = await prisma.leagueMember.create({
    data: { leagueId, userId, weeklyXp: status?.weeklyXp ?? 0 },
  });

  // 初始化 Redis Sorted Set
  const key = rankingKey(leagueId);
  await redis.zadd(key, member.weeklyXp, String(userId)).catch(() => null);
  await redis.expire(key, LEAGUE_RANKING_TTL).catch(() => null);

  logger.info('league.service: user assigned to league', {
    userId,
    leagueId,
    tier,
    weekStart,
  });

  return member.id;
}

/**
 * 获取用户当前联盟信息和 Top 10 排行榜。
 * 排行榜数据优先从 Redis Sorted Set（league:{leagueId}:weekly_xp）读取，
 * 隐私过滤（只返回 nickname/petAvatarMood/weeklyXp，不含 email/phone）。
 *
 * @param userId 用户 ID
 * @returns 联盟信息（含排行榜）
 */
export async function getLeagueInfo(userId: number): Promise<LeagueInfoResult> {
  // 确保用户已分配联盟
  await assignLeague(userId);

  // 获取用户当前联盟成员记录
  const member = await prisma.leagueMember.findFirst({
    where: { userId },
    include: { league: true },
    orderBy: { id: 'desc' },
  });

  if (!member) {
    throw new Error('League member not found after assignment');
  }

  const { tier } = member.league;
  const leagueId = member.leagueId;
  const key = rankingKey(leagueId);

  // 同步当前用户的 weeklyXp 到 Redis（确保数据最新）
  await redis.zadd(key, member.weeklyXp, String(userId)).catch(() => null);
  await redis.expire(key, LEAGUE_RANKING_TTL).catch(() => null);

  // 从 Redis Sorted Set 获取 Top 10（降序）
  // ZREVRANGE key 0 9 WITHSCORES
  const topRaw = await redis
    .zrevrange(key, 0, LEADERBOARD_TOP_N - 1, 'WITHSCORES')
    .catch(() => [] as string[]);

  // 解析 [userId, score, userId, score, ...] 格式
  const topEntries: Array<{ userId: number; weeklyXp: number }> = [];
  for (let i = 0; i < topRaw.length; i += 2) {
    topEntries.push({
      userId: parseInt(topRaw[i], 10),
      weeklyXp: Math.round(parseFloat(topRaw[i + 1])),
    });
  }

  // 若 Redis 为空，从 DB 回退并重建 Sorted Set
  if (topEntries.length === 0) {
    const dbMembers = await prisma.leagueMember.findMany({
      where: { leagueId },
      orderBy: { weeklyXp: 'desc' },
      take: LEADERBOARD_TOP_N,
    });
    for (const m of dbMembers) {
      topEntries.push({ userId: m.userId, weeklyXp: m.weeklyXp });
      // 重建 Redis Sorted Set
      await redis.zadd(key, m.weeklyXp, String(m.userId)).catch(() => null);
    }
    if (topEntries.length > 0) {
      await redis.expire(key, LEAGUE_RANKING_TTL).catch(() => null);
    }
  }

  // 获取联盟总成员数
  const totalMembers = await redis.zcard(key).catch(async () => {
    return prisma.leagueMember.count({ where: { leagueId } });
  });

  // 批量获取用户信息（隐私过滤：只取 nickname）
  const userIds = topEntries.map(e => e.userId);

  // 获取用户档案（nickname + dailyCalTarget）
  const [profiles, gamStatuses, pets, foodRecordAggs] = await Promise.all([
    prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, nickname: true, dailyCalTarget: true },
    }),
    prisma.gamificationStatus.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, streakDays: true },
    }),
    prisma.pet.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
    }),
    // 获取今日饮食记录汇总（用于计算心情）
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const dayStart = new Date(`${today}T00:00:00.000Z`);
      const dayEnd = new Date(`${today}T23:59:59.999Z`);
      return prisma.foodRecord.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          recordedAt: { gte: dayStart, lte: dayEnd },
        },
        _sum: { calories: true },
        _count: { mealType: true },
      });
    })(),
  ]);

  const nicknameMap = new Map(profiles.map(p => [p.userId, p.nickname]));
  const dailyTargetMap = new Map(
    profiles.map(p => [p.userId, p.dailyCalTarget ?? 2000])
  );
  const streakMap = new Map(gamStatuses.map(g => [g.userId, g.streakDays]));
  const hasPetSet = new Set(pets.map(p => p.userId));
  const foodAggMap = new Map(
    foodRecordAggs.map(r => [
      r.userId,
      { calories: r._sum.calories ?? 0, mealCount: r._count.mealType },
    ])
  );

  const topMembers: LeagueMemberResult[] = topEntries.map((entry, idx) => {
    const dailyTarget = dailyTargetMap.get(entry.userId) ?? 2000;
    const streakDays = streakMap.get(entry.userId) ?? 0;
    const foodAgg = foodAggMap.get(entry.userId) ?? {
      calories: 0,
      mealCount: 0,
    };

    // 计算宠物心情（隐私安全：只用于展示头像状态，不暴露个人数据）
    const petAvatarMood = hasPetSet.has(entry.userId)
      ? calcPetMood({
          totalCalories: foodAgg.calories,
          dailyTarget,
          mealCount: foodAgg.mealCount,
          streakDays,
        })
      : 'normal';

    return {
      userId: String(entry.userId),
      nickname: nicknameMap.get(entry.userId) ?? `用户${entry.userId}`,
      petAvatarMood,
      weeklyXp: entry.weeklyXp,
      rank: idx + 1,
    };
  });

  // 获取当前用户排名（ZREVRANK，0-indexed → +1）
  const userRankRaw = await redis
    .zrevrank(key, String(userId))
    .catch(() => null);
  const userRank =
    userRankRaw !== null ? userRankRaw + 1 : topMembers.length || 1;

  // 联盟名称：tier + weekStart
  const leagueName = `${tier.charAt(0).toUpperCase() + tier.slice(1)} League`;

  logger.debug('league.service: getLeagueInfo', {
    userId,
    leagueId,
    tier,
    userRank,
    topCount: topMembers.length,
  });

  return {
    leagueId,
    leagueName,
    tier,
    userRank,
    userWeeklyXp: member.weeklyXp,
    topMembers,
    totalMembers,
  };
}

/**
 * 获取用户上次联盟结算结果。
 *
 * @param userId 用户 ID
 * @returns 结算结果，若无历史结算则返回 null
 */
export async function getLeagueSettlement(
  userId: number
): Promise<LeagueSettlementResult | null> {
  const weekStart = getCurrentWeekStart();

  // 查找上周的联盟成员记录（weekStart 不等于本周）
  const pastMember = await prisma.leagueMember.findFirst({
    where: {
      userId,
      promoted: { not: null },
      league: { weekStart: { not: weekStart } },
    },
    include: { league: true },
    orderBy: { id: 'desc' },
  });

  if (!pastMember || pastMember.promoted === null) return null;

  const finalRank = pastMember.rank ?? 0;
  const promoted = pastMember.promoted === true;
  const demoted = pastMember.promoted === false;

  // 计算结算后的新 tier
  let newTier = pastMember.league.tier;
  if (promoted) {
    const currentTierIdx = TIER_RULES.findIndex(
      r => r.tier === pastMember.league.tier
    );
    if (currentTierIdx < TIER_RULES.length - 1) {
      newTier = TIER_RULES[currentTierIdx + 1].tier;
    }
  } else if (demoted) {
    const currentTierIdx = TIER_RULES.findIndex(
      r => r.tier === pastMember.league.tier
    );
    if (currentTierIdx > 0) {
      newTier = TIER_RULES[currentTierIdx - 1].tier;
    }
  }

  return {
    promoted: promoted ? true : null,
    demoted: demoted ? true : null,
    newTier,
    finalRank,
  };
}
