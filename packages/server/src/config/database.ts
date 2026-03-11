import { PrismaClient } from '@prisma/client';
import { logger } from '@/utils/logger';

class Database {
  private static instance: Database;
  public prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    // 监听 Prisma 事件
    this.prisma.$on('query', e => {
      logger.debug('Query: ' + e.query);
      logger.debug('Params: ' + e.params);
      logger.debug('Duration: ' + e.duration + 'ms');
    });

    this.prisma.$on('error', e => {
      logger.error('Prisma Error: ' + e.message);
    });

    this.prisma.$on('info', e => {
      logger.info('Prisma Info: ' + e.message);
    });

    this.prisma.$on('warn', e => {
      logger.warn('Prisma Warning: ' + e.message);
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Database disconnection failed:', error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

export const database = Database.getInstance();
export const prisma = database.prisma;
