# 浣熊卡路里 AI 开发规范

## 项目概述

浣熊卡路里是一款轻量级饮食记录应用，通过 AI 拍照识别和游戏化养成体验，让健康管理变得有趣。

## 技术栈

- 前端：React Native + TypeScript
- 后端：Express.js + Node.js
- 数据库：MongoDB + Redis
- 包管理：pnpm (monorepo)
- 部署：Docker

## 项目结构

```
packages/
├── mobile/          # React Native 应用
├── server/          # Express 服务端
└── shared/          # 共享代码和类型
```

## 代码生成规范

### 1. 通用规则

#### 文件命名
- React 组件：PascalCase (如 `FoodCard.tsx`)
- 工具函数：camelCase (如 `formatCalories.ts`)
- 常量文件：UPPER_SNAKE_CASE (如 `API_CONSTANTS.ts`)
- 样式文件：与组件同名 (如 `FoodCard.styles.ts`)

#### 代码风格
- 使用 TypeScript，避免 `any` 类型
- 优先使用函数式组件和 Hooks
- 使用 ES6+ 语法（箭头函数、解构、模板字符串）
- 保持函数简洁，单一职责原则
- 添加必要的注释，特别是复杂逻辑

#### 导入顺序
```typescript
// 1. React 相关
import React, { useState, useEffect } from 'react';

// 2. 第三方库
import { View, Text } from 'react-native';
import axios from 'axios';

// 3. 项目内部模块
import { FoodCard } from '@/components/food';
import { formatCalories } from '@/utils';

// 4. 类型定义
import type { FoodRecord } from '@/types';

// 5. 样式
import styles from './Component.styles';
```

### 2. React Native 组件规范

#### 组件结构模板
```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ComponentProps } from './types';

/**
 * 组件描述
 * @param props - 组件属性
 */
export const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // 1. Hooks
  const [state, setState] = useState<StateType>(initialValue);
  
  // 2. 副作用
  useEffect(() => {
    // 副作用逻辑
  }, [dependencies]);
  
  // 3. 事件处理函数
  const handleEvent = () => {
    // 处理逻辑
  };
  
  // 4. 渲染逻辑
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{prop1}</Text>
    </View>
  );
};

// 5. 样式定义
const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  text: {
    fontSize: 14,
    color: '#2E2E2E',
  },
});
```

#### 样式规范
- 使用 StyleSheet.create 定义样式
- 遵循 UI 设计规范中的颜色、字体、间距系统
- 使用常量定义主题色和尺寸
- 支持深色模式适配

```typescript
// theme.ts
export const colors = {
  primary: '#FFB347',
  primaryLight: '#FFD4A3',
  primaryDark: '#E6A042',
  secondary: '#7CB342',
  background: '#FFF9F0',
  text: '#2E2E2E',
  textSecondary: '#757575',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const fontSize = {
  h1: 28,
  h2: 24,
  h3: 20,
  body: 14,
  caption: 12,
};
```

### 3. Express 服务端规范

#### 控制器模板
```typescript
import { Request, Response, NextFunction } from 'express';
import { FoodService } from '../services/food.service';
import { ApiResponse } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * 食物识别控制器
 */
export class FoodController {
  /**
   * 识别食物
   */
  static async recognizeFood(req: Request, res: Response, next: NextFunction) {
    try {
      const { image } = req.body;
      const userId = req.user.id;
      
      // 调用服务层
      const result = await FoodService.recognizeFood(image, userId);
      
      // 返回成功响应
      return ApiResponse.success(res, result, '识别成功');
    } catch (error) {
      logger.error('食物识别失败', error);
      next(error);
    }
  }
}
```

#### 服务层模板
```typescript
import { FoodRecognitionAPI } from './external/logmeal';
import { FoodRecord } from '../models/FoodRecord';
import { RaccoonService } from './raccoon.service';

/**
 * 食物服务
 */
export class FoodService {
  /**
   * 识别食物并记录
   */
  static async recognizeFood(imageData: string, userId: string) {
    // 1. 调用外部 API 识别
    const recognition = await FoodRecognitionAPI.analyze(imageData);
    
    // 2. 保存记录
    const foodRecord = await FoodRecord.create({
      userId,
      foodName: recognition.foodName,
      calories: recognition.calories,
      nutrition: recognition.nutrition,
      imageUrl: recognition.imageUrl,
      recordedAt: new Date(),
    });
    
    // 3. 更新浣熊状态
    await RaccoonService.addExperience(userId, 10);
    
    // 4. 生成浣熊点评
    const comment = this.generateRaccoonComment(recognition.calories);
    
    return {
      foodRecord,
      comment,
    };
  }
  
  /**
   * 生成浣熊点评
   */
  private static generateRaccoonComment(calories: number): string {
    if (calories < 200) {
      return '这份食物热量不高，很健康哦！';
    } else if (calories < 500) {
      return '适中的热量，保持这个节奏～';
    } else {
      return '这盘的热量足够我跑三圈啦！不过偶尔放纵没关系～';
    }
  }
}
```

#### 数据模型模板
```typescript
import mongoose, { Schema, Document } from 'mongoose';

/**
 * 食物记录接口
 */
export interface IFoodRecord extends Document {
  userId: string;
  foodName: string;
  calories: number;
  nutrition: {
    protein: number;
    carbs: number;
    fat: number;
  };
  imageUrl?: string;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 食物记录模型
 */
const FoodRecordSchema = new Schema<IFoodRecord>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    foodName: {
      type: String,
      required: true,
    },
    calories: {
      type: Number,
      required: true,
      min: 0,
    },
    nutrition: {
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fat: { type: Number, default: 0 },
    },
    imageUrl: String,
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// 索引
FoodRecordSchema.index({ userId: 1, recordedAt: -1 });

export const FoodRecord = mongoose.model<IFoodRecord>('FoodRecord', FoodRecordSchema);
```

#### API 响应格式
```typescript
/**
 * 统一响应格式
 */
export class ApiResponse {
  /**
   * 成功响应
   */
  static success<T>(res: Response, data: T, message = 'Success') {
    return res.json({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * 错误响应
   */
  static error(res: Response, code: string, message: string, statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 4. 共享类型定义

#### 类型文件结构
```typescript
// packages/shared/types/food.types.ts

/**
 * 食物记录类型
 */
export interface FoodRecord {
  id: string;
  userId: string;
  foodName: string;
  calories: number;
  nutrition: NutritionInfo;
  imageUrl?: string;
  recordedAt: Date;
}

/**
 * 营养信息
 */
export interface NutritionInfo {
  protein: number;  // 蛋白质 (g)
  carbs: number;    // 碳水化合物 (g)
  fat: number;      // 脂肪 (g)
}

/**
 * 食物识别结果
 */
export interface FoodRecognitionResult {
  foodName: string;
  calories: number;
  nutrition: NutritionInfo;
  confidence: number;  // 识别置信度 0-1
}
```

### 5. 错误处理规范

#### 自定义错误类
```typescript
/**
 * 应用错误基类
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 认证错误
 */
export class AuthError extends AppError {
  constructor(message = '认证失败') {
    super('AUTH_REQUIRED', message, 401);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message = '参数验证失败') {
    super('VALIDATION_ERROR', message, 400);
  }
}
```

#### 错误处理中间件
```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 记录错误日志
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  
  // 处理自定义错误
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
  
  // 处理未知错误
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    },
    timestamp: new Date().toISOString(),
  });
};
```

### 6. 测试规范

#### 单元测试模板
```typescript
import { FoodService } from '../services/food.service';
import { FoodRecord } from '../models/FoodRecord';

describe('FoodService', () => {
  describe('recognizeFood', () => {
    it('应该成功识别食物并返回结果', async () => {
      // Arrange
      const mockImage = 'base64-image-data';
      const userId = 'user-123';
      
      // Act
      const result = await FoodService.recognizeFood(mockImage, userId);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.foodRecord).toBeDefined();
      expect(result.comment).toBeDefined();
    });
    
    it('应该在识别失败时抛出错误', async () => {
      // Arrange
      const invalidImage = '';
      const userId = 'user-123';
      
      // Act & Assert
      await expect(
        FoodService.recognizeFood(invalidImage, userId)
      ).rejects.toThrow();
    });
  });
});
```

### 7. 性能优化规范

#### 图片处理
```typescript
/**
 * 压缩图片
 */
export const compressImage = async (
  imageUri: string,
  quality = 0.8
): Promise<string> => {
  const manipResult = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1024 } }],
    { compress: quality, format: SaveFormat.JPEG }
  );
  return manipResult.uri;
};
```

#### 列表优化
```typescript
import { FlatList } from 'react-native';

/**
 * 优化的列表组件
 */
export const FoodList: React.FC<Props> = ({ data }) => {
  const renderItem = useCallback(
    ({ item }: { item: FoodRecord }) => (
      <FoodCard food={item} />
    ),
    []
  );
  
  const keyExtractor = useCallback(
    (item: FoodRecord) => item.id,
    []
  );
  
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      removeClippedSubviews
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={10}
    />
  );
};
```

### 8. 安全规范

#### 输入验证
```typescript
import Joi from 'joi';

/**
 * 食物记录验证规则
 */
export const foodRecordSchema = Joi.object({
  foodName: Joi.string().required().min(1).max(100),
  calories: Joi.number().required().min(0).max(10000),
  nutrition: Joi.object({
    protein: Joi.number().min(0),
    carbs: Joi.number().min(0),
    fat: Joi.number().min(0),
  }),
});

/**
 * 验证中间件
 */
export const validate = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return ApiResponse.error(
        res,
        'VALIDATION_ERROR',
        error.details[0].message
      );
    }
    next();
  };
};
```

#### JWT 认证
```typescript
import jwt from 'jsonwebtoken';

/**
 * 生成 JWT Token
 */
export const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
};

/**
 * 验证 Token 中间件
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return ApiResponse.error(res, 'AUTH_REQUIRED', '需要认证', 401);
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return ApiResponse.error(res, 'INVALID_TOKEN', 'Token 无效', 401);
  }
};
```

### 9. 日志规范

```typescript
import winston from 'winston';

/**
 * 日志配置
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

### 10. Git 提交规范

使用 Conventional Commits：

```
feat: 添加食物识别功能
fix: 修复浣熊动画卡顿问题
docs: 更新 API 文档
style: 调整首页布局
refactor: 重构用户认证逻辑
perf: 优化图片加载性能
test: 添加食物识别单元测试
chore: 更新依赖包
```

## AI 生成代码时的注意事项

1. **始终使用 TypeScript**：所有新代码必须使用 TypeScript，提供完整的类型定义
2. **遵循项目结构**：将代码放在正确的目录中（controllers/services/models）
3. **保持一致性**：遵循现有代码的风格和模式
4. **添加注释**：为复杂逻辑添加清晰的注释
5. **错误处理**：所有异步操作必须有错误处理
6. **性能考虑**：注意图片处理、列表渲染等性能敏感操作
7. **安全第一**：验证所有用户输入，使用参数化查询
8. **可测试性**：编写易于测试的代码，避免紧耦合
9. **UI 规范**：遵循设计规范中的颜色、字体、间距系统
10. **文档完善**：为公共 API 和复杂函数添加 JSDoc 注释

## 常用代码片段

### React Native 屏幕模板
```typescript
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { colors, spacing } from '@/theme';

export const ScreenName: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Screen Title</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
});
```

### Express 路由模板
```typescript
import { Router } from 'express';
import { FoodController } from '../controllers/food.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { foodRecordSchema } from '../validators/food.validator';

const router = Router();

/**
 * @route   POST /api/v1/food/recognize
 * @desc    识别食物
 * @access  Private
 */
router.post(
  '/recognize',
  authenticateToken,
  validate(foodRecordSchema),
  FoodController.recognizeFood
);

export default router;
```

这个规范确保了浣熊卡路里项目的代码质量、一致性和可维护性。
