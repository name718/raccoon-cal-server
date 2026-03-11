import { database } from '@/config/database';
import { redisClient } from '@/config/redis';

// 测试环境设置
beforeAll(async () => {
  // 连接数据库
  await database.connect();

  // 连接 Redis
  await redisClient.connect();
});

afterAll(async () => {
  // 清理测试数据
  await database.prisma.$executeRaw`TRUNCATE TABLE users`;
  await database.prisma.$executeRaw`TRUNCATE TABLE food_records`;
  await database.prisma.$executeRaw`TRUNCATE TABLE pets`;
  await database.prisma.$executeRaw`TRUNCATE TABLE tasks`;
  await database.prisma.$executeRaw`TRUNCATE TABLE friendships`;

  // 断开连接
  await database.disconnect();
  await redisClient.disconnect();
});

beforeEach(async () => {
  // 每个测试前清理数据
  await database.prisma.user.deleteMany();
});

// 全局测试工具
global.testUtils = {
  createTestUser: async (overrides = {}) => {
    return await database.prisma.user.create({
      data: {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        ...overrides,
      },
    });
  },
};
