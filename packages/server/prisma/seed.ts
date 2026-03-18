import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { TASK_POOL } from '../src/constants/taskPool';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run Prisma seed.');
}

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

// ─── 成就定义（20+ 条，Property 22：成就幂等性）──────────────────────────────
// key 全局唯一，upsert 保证幂等
const ACHIEVEMENT_DEFS = [
  // 饮食记录类
  {
    key: 'first_record',
    title: '初次记录',
    description: '完成第一次饮食记录',
    xpReward: 50,
    iconName: 'RaccoonHappy',
  },
  {
    key: 'record_10',
    title: '记录达人',
    description: '累计完成 10 次饮食记录',
    xpReward: 100,
    iconName: 'RaccoonExcited',
  },
  {
    key: 'record_50',
    title: '饮食日记',
    description: '累计完成 50 次饮食记录',
    xpReward: 200,
    iconName: 'RaccoonExcited',
  },
  {
    key: 'record_100',
    title: '百次记录',
    description: '累计完成 100 次饮食记录',
    xpReward: 500,
    iconName: 'RaccoonSuccess',
  },
  // 卡路里目标类
  {
    key: 'goal_first_day',
    title: '初次达标',
    description: '第一次完成当日卡路里目标',
    xpReward: 50,
    iconName: 'RaccoonHappy',
  },
  {
    key: 'goal_7_days',
    title: '一周达标',
    description: '累计 7 天卡路里达标',
    xpReward: 150,
    iconName: 'RaccoonGoals',
  },
  {
    key: 'goal_30_days',
    title: '月度达标',
    description: '累计 30 天卡路里达标',
    xpReward: 500,
    iconName: 'RaccoonGoals',
  },
  // Streak 连续打卡类
  {
    key: 'streak_3',
    title: '三日连击',
    description: '连续打卡 3 天',
    xpReward: 30,
    iconName: 'RaccoonHappy',
  },
  {
    key: 'streak_7',
    title: '一周坚持',
    description: '连续打卡 7 天',
    xpReward: 50,
    iconName: 'RaccoonExcited',
  },
  {
    key: 'streak_30',
    title: '月度坚持',
    description: '连续打卡 30 天',
    xpReward: 200,
    iconName: 'RaccoonSuccess',
  },
  {
    key: 'streak_100',
    title: '百日坚持',
    description: '连续打卡 100 天',
    xpReward: 1000,
    iconName: 'RaccoonSuccess',
  },
  // 等级成就类
  {
    key: 'level_5',
    title: '初级探索者',
    description: '达到 5 级',
    xpReward: 100,
    iconName: 'RaccoonThinking',
  },
  {
    key: 'level_10',
    title: '中级探索者',
    description: '达到 10 级',
    xpReward: 200,
    iconName: 'RaccoonThinking',
  },
  {
    key: 'level_20',
    title: '高级探索者',
    description: '达到 20 级',
    xpReward: 500,
    iconName: 'RaccoonExcited',
  },
  {
    key: 'level_50',
    title: '传奇浣熊',
    description: '达到最高等级 50 级',
    xpReward: 2000,
    iconName: 'RaccoonSuccess',
  },
  // 任务完成类
  {
    key: 'task_first',
    title: '任务新手',
    description: '完成第一个每日任务',
    xpReward: 30,
    iconName: 'RaccoonHappy',
  },
  {
    key: 'task_full_day',
    title: '全勤任务',
    description: '单日完成全部 3 个每日任务',
    xpReward: 50,
    iconName: 'RaccoonExcited',
  },
  {
    key: 'task_full_week',
    title: '任务周冠军',
    description: '连续 7 天完成全部每日任务',
    xpReward: 300,
    iconName: 'RaccoonSuccess',
  },
  // 宠物互动类
  {
    key: 'pet_first_interact',
    title: '初次互动',
    description: '第一次与小R互动',
    xpReward: 20,
    iconName: 'RaccoonGreeting',
  },
  {
    key: 'pet_interact_30',
    title: '亲密伙伴',
    description: '累计与小R互动 30 次',
    xpReward: 150,
    iconName: 'RaccoonHappy',
  },
  // 联盟类
  {
    key: 'league_first_join',
    title: '联盟新人',
    description: '首次加入联盟',
    xpReward: 30,
    iconName: 'RaccoonGreeting',
  },
  {
    key: 'league_promoted',
    title: '联盟晋升',
    description: '首次在联盟结算中晋升',
    xpReward: 100,
    iconName: 'RaccoonExcited',
  },
  // 体重记录类
  {
    key: 'weight_first',
    title: '体重记录',
    description: '第一次记录体重',
    xpReward: 20,
    iconName: 'RaccoonMeasuring',
  },
  {
    key: 'weight_10_records',
    title: '体重追踪者',
    description: '累计记录体重 10 次',
    xpReward: 100,
    iconName: 'RaccoonMeasuring',
  },
];

async function main() {
  console.log('开始写入种子数据...');

  // ── 成就定义（幂等 upsert）──────────────────────────────────────────────────
  console.log(`写入 ${ACHIEVEMENT_DEFS.length} 条成就定义...`);
  for (const def of ACHIEVEMENT_DEFS) {
    await prisma.achievementDef.upsert({
      where: { key: def.key },
      update: {
        title: def.title,
        description: def.description,
        xpReward: def.xpReward,
        iconName: def.iconName,
      },
      create: def,
    });
  }
  console.log(`✓ 成就定义写入完成（共 ${ACHIEVEMENT_DEFS.length} 条）`);

  // ── 示例用户（开发/测试用）──────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('password123', 12);

  const user1 = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      username: 'demo_user',
      email: 'demo@example.com',
      passwordHash: hashedPassword,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      username: 'test_user',
      email: 'test@example.com',
      passwordHash: hashedPassword,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user1.id },
    update: {},
    create: {
      userId: user1.id,
      nickname: 'Demo 浣熊',
      gender: 'male',
      height: 170,
      weight: 65,
      age: 25,
      goal: 'maintain',
      activityLevel: 'moderately_active',
      dailyCalTarget: 2200,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user2.id },
    update: {},
    create: {
      userId: user2.id,
      nickname: 'Test 浣熊',
      gender: 'female',
      height: 165,
      weight: 55,
      age: 24,
      goal: 'lose_weight',
      activityLevel: 'lightly_active',
      dailyCalTarget: 1600,
    },
  });

  // ── 宠物（幂等 upsert）──────────────────────────────────────────────────────
  await prisma.pet.upsert({
    where: { userId: user1.id },
    update: {},
    create: { userId: user1.id, name: '小浣熊' },
  });

  await prisma.pet.upsert({
    where: { userId: user2.id },
    update: {},
    create: { userId: user2.id, name: '胖浣熊' },
  });

  // ── 游戏化状态（幂等 upsert）────────────────────────────────────────────────
  await prisma.gamificationStatus.upsert({
    where: { userId: user1.id },
    update: {},
    create: { userId: user1.id },
  });

  await prisma.gamificationStatus.upsert({
    where: { userId: user2.id },
    update: {},
    create: { userId: user2.id },
  });

  console.log('✓ 示例用户、档案、宠物、游戏化状态写入完成');
  console.log('种子数据写入完成！');
  console.log(`  - 成就定义：${ACHIEVEMENT_DEFS.length} 条`);
  console.log(`  - 任务池：${TASK_POOL.length} 种任务类型`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
