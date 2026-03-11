import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始数据库种子数据...');

  // 创建示例用户
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

  // 为用户创建宠物
  await prisma.pet.upsert({
    where: { userId: user1.id },
    update: {},
    create: {
      userId: user1.id,
      name: '小浣熊',
    },
  });

  await prisma.pet.upsert({
    where: { userId: user2.id },
    update: {},
    create: {
      userId: user2.id,
      name: '胖浣熊',
    },
  });

  // 创建示例任务
  await prisma.task.createMany({
    data: [
      {
        userId: user1.id,
        taskType: 'daily',
        title: '记录三餐',
        description: '今天记录早中晚三餐',
        targetValue: 3,
        rewardExp: 50,
      },
      {
        userId: user1.id,
        taskType: 'weekly',
        title: '坚持一周',
        description: '连续7天记录饮食',
        targetValue: 7,
        rewardExp: 200,
      },
      {
        userId: user2.id,
        taskType: 'daily',
        title: '记录三餐',
        description: '今天记录早中晚三餐',
        targetValue: 3,
        rewardExp: 50,
      },
    ],
    skipDuplicates: true,
  });

  console.log('种子数据创建完成!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
