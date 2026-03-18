import { prisma } from '@/config/database';
import { TASK_POOL } from '@/constants/taskPool';
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';
import { awardXp } from '@/utils/gamificationEngine';

// ─── 类型 ────────────────────────────────────────────────────────────────────

export interface DailyTaskResult {
  id: number;
  taskKey: string;
  title: string;
  xpReward: number;
  completed: boolean;
  completedAt: Date | null;
  taskDate: string;
}

export interface DailyTasksResponse {
  tasks: DailyTaskResult[];
  allCompleted: boolean;
  completedCount: number;
  bonusAwarded: boolean;
}

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** 每日任务数量 */
const DAILY_TASK_COUNT = 3;

/** 全勤奖励 XP */
const FULL_COMPLETION_BONUS_XP = 30;

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 将 Date 格式化为 YYYY-MM-DD 字符串（UTC） */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 全勤奖励 Redis 幂等键 */
function bonusCacheKey(userId: number, date: string): string {
  return `task:bonus:${userId}:${date}`;
}

// ─── 服务函数 ─────────────────────────────────────────────────────────────────

/**
 * Fisher-Yates 洗牌算法，返回打乱后的新数组（不修改原数组）。
 */
function fisherYatesShuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 为用户生成当日 3 条不重复的每日任务（从任务池随机抽取）。
 * 使用 Fisher-Yates 洗牌算法保证随机性，DB 唯一约束（userId + taskKey + taskDate）保证幂等。
 *
 * @param userId 用户 ID
 * @param date   日期字符串（YYYY-MM-DD）
 * @returns 生成的任务列表
 */
export async function generateDailyTasks(
  userId: number,
  date: string
): Promise<DailyTasksResponse> {
  // Fisher-Yates 洗牌后取前 DAILY_TASK_COUNT 条（Property 21：不重复性）
  const shuffled = fisherYatesShuffle(TASK_POOL);
  const selected = shuffled.slice(0, DAILY_TASK_COUNT);

  const created: DailyTaskResult[] = [];

  for (const task of selected) {
    try {
      const record = await prisma.dailyTask.create({
        data: {
          userId,
          taskKey: task.taskKey,
          title: task.title,
          xpReward: task.xpReward,
          taskDate: date,
        },
      });
      created.push(record);
    } catch (err: unknown) {
      // P2002 = unique constraint violation（任务已存在，跳过）
      if ((err as { code?: string }).code !== 'P2002') throw err;
      logger.debug('task.service: task already exists, skipping', {
        userId,
        taskKey: task.taskKey,
        date,
      });
    }
  }

  logger.info('task.service: daily tasks generated', {
    userId,
    date,
    count: created.length,
  });

  return getDailyTasks(userId, date);
}

/**
 * 获取用户当日任务列表，若当日无任务则自动生成。
 *
 * @param userId 用户 ID
 * @param date   日期字符串（YYYY-MM-DD），默认今日
 * @returns 当日任务列表及完成状态
 */
export async function getDailyTasks(
  userId: number,
  date?: string
): Promise<DailyTasksResponse> {
  const taskDate = date ?? toDateString(new Date());

  let tasks = await prisma.dailyTask.findMany({
    where: { userId, taskDate },
    orderBy: { id: 'asc' },
  });

  // 若当日无任务，自动生成
  if (tasks.length === 0) {
    await generateDailyTasks(userId, taskDate);
    tasks = await prisma.dailyTask.findMany({
      where: { userId, taskDate },
      orderBy: { id: 'asc' },
    });
  }

  const completedCount = tasks.filter(t => t.completed).length;
  const allCompleted = tasks.length > 0 && completedCount === tasks.length;

  // 检查全勤奖励是否已发放
  const bonusKey = bonusCacheKey(userId, taskDate);
  const bonusAwarded = !!(await redis.get(bonusKey).catch(() => null));

  return {
    tasks,
    allCompleted,
    completedCount,
    bonusAwarded,
  };
}

/**
 * 自动检查并完成满足条件的任务，授予对应 XP。
 * 若全部完成则额外授予全勤奖励 +30 XP（幂等）。
 *
 * @param userId 用户 ID
 * @param date   日期字符串（YYYY-MM-DD），默认今日
 */
export async function checkAndCompleteTasks(
  userId: number,
  date?: string
): Promise<void> {
  const taskDate = date ?? toDateString(new Date());

  const tasks = await prisma.dailyTask.findMany({
    where: { userId, taskDate, completed: false },
  });

  if (tasks.length === 0) return;

  // 获取当日饮食记录（用于判断餐次任务）
  const dayStart = new Date(`${taskDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${taskDate}T23:59:59.999Z`);

  const foodRecords = await prisma.foodRecord.findMany({
    where: { userId, recordedAt: { gte: dayStart, lte: dayEnd } },
    select: { mealType: true, calories: true },
  });

  const mealTypes = new Set(foodRecords.map(r => r.mealType));
  const totalCalories = foodRecords.reduce((sum, r) => sum + r.calories, 0);

  // 获取用户每日卡路里目标
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const dailyTarget = profile?.dailyCalTarget ?? 2000;

  // 获取宠物互动状态
  const petInteractKey = `pet:interact:${userId}:${taskDate}`;
  const petInteracted = !!(await redis.get(petInteractKey).catch(() => null));

  for (const task of tasks) {
    let shouldComplete = false;

    switch (task.taskKey) {
      case 'record_breakfast':
        shouldComplete = mealTypes.has('breakfast');
        break;
      case 'record_lunch':
        shouldComplete = mealTypes.has('lunch');
        break;
      case 'record_dinner':
        shouldComplete = mealTypes.has('dinner');
        break;
      case 'record_3_meals':
        shouldComplete =
          mealTypes.has('breakfast') &&
          mealTypes.has('lunch') &&
          mealTypes.has('dinner');
        break;
      case 'stay_in_calorie_goal':
        shouldComplete =
          foodRecords.length > 0 &&
          totalCalories >= dailyTarget * 0.9 &&
          totalCalories <= dailyTarget * 1.1;
        break;
      case 'interact_pet':
        shouldComplete = petInteracted;
        break;
    }

    if (!shouldComplete) continue;

    // 标记任务完成
    await prisma.dailyTask.update({
      where: { id: task.id },
      data: { completed: true, completedAt: new Date() },
    });

    // 授予任务 XP（幂等 refId = task_{id}）
    await awardXp(userId, 'task_complete', `task_${task.id}`, task.xpReward);

    logger.info('task.service: task completed', {
      userId,
      taskKey: task.taskKey,
      xpReward: task.xpReward,
      taskDate,
    });
  }

  // 检查全勤奖励（3 条全完成额外 +30 XP，幂等）
  await checkFullCompletionBonus(userId, taskDate);
}

/**
 * 检查并发放全勤奖励（3 条全完成额外 +30 XP）。
 * 使用 Redis 幂等键防止重复发放。
 *
 * @param userId   用户 ID
 * @param taskDate 日期字符串（YYYY-MM-DD）
 */
async function checkFullCompletionBonus(
  userId: number,
  taskDate: string
): Promise<void> {
  const bonusKey = bonusCacheKey(userId, taskDate);
  const alreadyAwarded = await redis.get(bonusKey).catch(() => null);
  if (alreadyAwarded) return;

  const allTasks = await prisma.dailyTask.findMany({
    where: { userId, taskDate },
  });

  if (allTasks.length === 0) return;

  const allCompleted = allTasks.every(t => t.completed);
  if (!allCompleted) return;

  // 发放全勤奖励
  await awardXp(
    userId,
    'task_full_completion',
    `full_${userId}_${taskDate}`,
    FULL_COMPLETION_BONUS_XP
  );

  // 设置幂等标记（TTL 至次日零点）
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const ttl = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
  await redis.set(bonusKey, '1', 'EX', ttl).catch(() => null);

  logger.info('task.service: full completion bonus awarded', {
    userId,
    taskDate,
    bonusXp: FULL_COMPLETION_BONUS_XP,
  });
}
