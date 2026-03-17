import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import { awardXp, calcLevel } from '@/utils/gamificationEngine';

// ─── 类型 ────────────────────────────────────────────────────────────────────

/** 对外暴露的成就（含解锁状态） */
export interface AchievementResult {
  key: string;
  title: string;
  description: string;
  xpReward: number;
  iconName: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

/** 成就解锁结果 */
export interface UnlockResult {
  newlyUnlocked: string[];
  totalUnlocked: number;
  totalAchievements: number;
}

// ─── 幂等键 ──────────────────────────────────────────────────────────────────

function unlockDedupKey(userId: number, achievementKey: string): string {
  return `achievement:unlock:${userId}:${achievementKey}`;
}

// ─── 服务函数 ─────────────────────────────────────────────────────────────────

/**
 * 获取全部成就定义，并附带当前用户的解锁状态。
 *
 * @param userId 用户 ID
 * @returns 成就列表（含解锁状态）
 */
export async function getAchievements(
  userId: number
): Promise<AchievementResult[]> {
  const [allDefs, userAchievements] = await Promise.all([
    prisma.achievementDef.findMany({ orderBy: { id: 'asc' } }),
    prisma.userAchievement.findMany({ where: { userId } }),
  ]);

  const unlockedMap = new Map<string, Date>(
    userAchievements.map(ua => [ua.achievementKey, ua.unlockedAt])
  );

  return allDefs.map(def => {
    const unlockedAt = unlockedMap.get(def.key) ?? null;
    return {
      key: def.key,
      title: def.title,
      description: def.description,
      xpReward: def.xpReward,
      iconName: def.iconName,
      unlocked: unlockedMap.has(def.key),
      unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
    };
  });
}

/**
 * 检查并解锁满足条件的成就（幂等）。
 * 每个成就只解锁一次，重复调用不重复授予 XP。
 *
 * @param userId 用户 ID
 * @returns 解锁结果（新解锁的成就 key 列表）
 */
export async function checkAndUnlockAchievements(
  userId: number
): Promise<UnlockResult> {
  // 并行获取所有需要的数据
  const [
    allDefs,
    userAchievements,
    gamificationStatus,
    foodRecordCount,
    weightRecordCount,
    dailyTasks,
    leagueMember,
    petInteractCount,
  ] = await Promise.all([
    prisma.achievementDef.findMany(),
    prisma.userAchievement.findMany({ where: { userId } }),
    prisma.gamificationStatus.findUnique({ where: { userId } }),
    prisma.foodRecord.count({ where: { userId } }),
    prisma.weightRecord.count({ where: { userId } }),
    prisma.dailyTask.findMany({ where: { userId } }),
    prisma.leagueMember.findFirst({ where: { userId } }),
    // 宠物互动次数：通过 XP 流水中 reason=pet_interact 的记录数统计
    prisma.xpTransaction.count({ where: { userId, reason: 'pet_interact' } }),
  ]);

  const alreadyUnlocked = new Set(
    userAchievements.map(ua => ua.achievementKey)
  );
  const newlyUnlocked: string[] = [];

  const streakDays = gamificationStatus?.streakDays ?? 0;
  const totalXp = gamificationStatus?.totalXp ?? 0;
  const level = calcLevel(totalXp);

  // 统计累计卡路里达标天数（通过 XP 流水中 reason=daily_goal 的记录数）
  const goalDaysCount = await prisma.xpTransaction.count({
    where: { userId, reason: 'daily_goal' },
  });

  // 统计全勤任务天数（通过 XP 流水中 reason=task_full_completion 的记录数，用于连续全勤检查）

  // 检查是否曾经在联盟结算中晋升
  const hasLeaguePromotion = await prisma.leagueMember.findFirst({
    where: { userId, promoted: true },
  });

  // 检查是否完成过任意每日任务
  const completedTaskCount = dailyTasks.filter(t => t.completed).length;

  // 检查单日是否完成全部 3 个任务（全勤任务）
  const taskDateMap = new Map<string, number>();
  for (const task of dailyTasks) {
    if (task.completed) {
      taskDateMap.set(task.taskDate, (taskDateMap.get(task.taskDate) ?? 0) + 1);
    }
  }
  const hasFullDayTask = [...taskDateMap.values()].some(count => count >= 3);

  // 检查连续 7 天全勤任务（通过 task_full_completion XP 流水）
  const fullCompletionDates = await prisma.xpTransaction.findMany({
    where: { userId, reason: 'task_full_completion' },
    select: { refId: true },
    orderBy: { earnedAt: 'asc' },
  });
  const hasFullWeekTask = checkConsecutiveDays(
    fullCompletionDates.map(t => t.refId?.replace(`full_${userId}_`, '') ?? ''),
    7
  );

  // ─── 解锁条件映射 ──────────────────────────────────────────────────────────

  const unlockConditions: Record<string, boolean> = {
    // 饮食记录类
    first_record: foodRecordCount >= 1,
    record_10: foodRecordCount >= 10,
    record_50: foodRecordCount >= 50,
    record_100: foodRecordCount >= 100,

    // 卡路里目标类
    goal_first_day: goalDaysCount >= 1,
    goal_7_days: goalDaysCount >= 7,
    goal_30_days: goalDaysCount >= 30,

    // Streak 连续打卡类
    streak_3: streakDays >= 3,
    streak_7: streakDays >= 7,
    streak_30: streakDays >= 30,
    streak_100: streakDays >= 100,

    // 等级成就类
    level_5: level >= 5,
    level_10: level >= 10,
    level_20: level >= 20,
    level_50: level >= 50,

    // 任务完成类
    task_first: completedTaskCount >= 1,
    task_full_day: hasFullDayTask,
    task_full_week: hasFullWeekTask,

    // 宠物互动类
    pet_first_interact: petInteractCount >= 1,
    pet_interact_30: petInteractCount >= 30,

    // 联盟类
    league_first_join: leagueMember !== null,
    league_promoted: hasLeaguePromotion !== null,

    // 体重记录类
    weight_first: weightRecordCount >= 1,
    weight_10_records: weightRecordCount >= 10,
  };

  // ─── 逐一检查并解锁 ────────────────────────────────────────────────────────

  for (const def of allDefs) {
    if (alreadyUnlocked.has(def.key)) continue;

    const shouldUnlock = unlockConditions[def.key] ?? false;
    if (!shouldUnlock) continue;

    // Redis 去重（防止并发重复解锁）
    const dedupKey = unlockDedupKey(userId, def.key);
    const alreadyProcessing = await redis.get(dedupKey).catch(() => null);
    if (alreadyProcessing) continue;

    // 写入 UserAchievement（DB 唯一约束兜底幂等）
    try {
      await prisma.userAchievement.create({
        data: { userId, achievementKey: def.key },
      });
    } catch (err: unknown) {
      // P2002 = unique constraint violation（已解锁，跳过）
      if ((err as { code?: string }).code === 'P2002') {
        await redis.set(dedupKey, '1', 'EX', 86400).catch(() => null);
        continue;
      }
      throw err;
    }

    // 设置 Redis 去重标记
    await redis.set(dedupKey, '1', 'EX', 86400).catch(() => null);

    // 授予成就 XP（幂等 refId = achievement_{key}）
    await awardXp(
      userId,
      'achievement',
      `achievement_${def.key}`,
      def.xpReward
    );

    newlyUnlocked.push(def.key);

    logger.info('achievement.service: achievement unlocked', {
      userId,
      achievementKey: def.key,
      xpReward: def.xpReward,
    });
  }

  const totalUnlocked = alreadyUnlocked.size + newlyUnlocked.length;

  return {
    newlyUnlocked,
    totalUnlocked,
    totalAchievements: allDefs.length,
  };
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 检查日期列表中是否存在连续 N 天的序列。
 *
 * @param dates  日期字符串数组（YYYY-MM-DD），可含重复或乱序
 * @param n      需要连续的天数
 * @returns 是否存在连续 N 天
 */
function checkConsecutiveDays(dates: string[], n: number): boolean {
  if (dates.length < n) return false;

  const uniqueSorted = [
    ...new Set(dates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))),
  ].sort();
  if (uniqueSorted.length < n) return false;

  let consecutive = 1;
  for (let i = 1; i < uniqueSorted.length; i++) {
    const prev = new Date(uniqueSorted[i - 1]);
    const curr = new Date(uniqueSorted[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      consecutive++;
      if (consecutive >= n) return true;
    } else {
      consecutive = 1;
    }
  }

  return consecutive >= n;
}
