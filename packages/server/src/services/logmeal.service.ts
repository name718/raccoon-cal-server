import axios from 'axios';
import sharp from 'sharp';
import { config } from '@/config';
import { logger } from '@/utils/logger';

// ─── 类型 ────────────────────────────────────────────────────────────────────

/** 单个识别食物结果 */
export interface RecognizedFood {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  servingSize: number;
}

/** 食物识别响应 */
export interface FoodRecognitionResult {
  foods: RecognizedFood[];
  confidence: number;
}

/** LogMeal API 原始响应结构（部分字段） */
interface LogMealSegment {
  recognition_results?: Array<{
    name?: string;
    id?: number;
    prob?: number;
    nutritional_info?: {
      calories?: number;
      totalNutrients?: {
        PROCNT?: { quantity?: number };
        FAT?: { quantity?: number };
        CHOCDF?: { quantity?: number };
      };
    };
  }>;
}

interface LogMealResponse {
  segmentation_results?: LogMealSegment[];
  food_name?: string[];
  prob?: number;
}

// ─── 常量 ────────────────────────────────────────────────────────────────────

/** 置信度阈值，低于此值视为识别失败 */
const CONFIDENCE_THRESHOLD = 0.3;

/** LogMeal API 请求超时（毫秒） */
const API_TIMEOUT_MS = 10_000;

/** 图片预处理：最大宽度 */
const IMAGE_MAX_WIDTH = 800;

/** 图片预处理：JPEG 质量 */
const IMAGE_JPEG_QUALITY = 80;

// ─── 图片预处理 ───────────────────────────────────────────────────────────────

/**
 * 将图片压缩至 800px 宽、质量 80% 的 JPEG，减少 API 传输量。
 */
export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: IMAGE_JPEG_QUALITY })
    .toBuffer();
}

// ─── 响应解析 ─────────────────────────────────────────────────────────────────

/**
 * 将 LogMeal API 原始响应解析为统一的 RecognizedFood 列表。
 * 若结果为空或置信度不足，返回空列表。
 */
function parseLogMealResponse(data: LogMealResponse): FoodRecognitionResult {
  const segments = data.segmentation_results ?? [];

  if (segments.length === 0) {
    return { foods: [], confidence: 0 };
  }

  const foods: RecognizedFood[] = [];
  let totalConfidence = 0;
  let count = 0;

  for (const segment of segments) {
    const results = segment.recognition_results ?? [];
    for (const item of results) {
      const prob = item.prob ?? 0;
      totalConfidence += prob;
      count++;

      if (prob < CONFIDENCE_THRESHOLD) continue;

      const nutrients = item.nutritional_info?.totalNutrients;
      foods.push({
        name: item.name ?? 'Unknown food',
        calories: item.nutritional_info?.calories ?? 0,
        protein: nutrients?.PROCNT?.quantity ?? 0,
        fat: nutrients?.FAT?.quantity ?? 0,
        carbs: nutrients?.CHOCDF?.quantity ?? 0,
        servingSize: 100,
      });
    }
  }

  const avgConfidence = count > 0 ? totalConfidence / count : 0;

  // 整体置信度不足时返回空列表
  if (avgConfidence < CONFIDENCE_THRESHOLD) {
    return { foods: [], confidence: 0 };
  }

  return { foods, confidence: avgConfidence };
}

// ─── 主函数 ───────────────────────────────────────────────────────────────────

/**
 * 调用 LogMeal API 识别图片中的食物。
 *
 * 流程：
 * 1. 预处理图片（Sharp 压缩）
 * 2. 构建 multipart/form-data 请求
 * 3. 调用 LogMeal /v2/image/segmentation/complete/v1.0
 * 4. 解析结果，置信度 < 0.3 或空结果返回 { foods: [], confidence: 0 }
 *
 * @param imageBuffer 原始图片 Buffer
 * @returns 识别结果
 */
export async function recognizeFood(
  imageBuffer: Buffer
): Promise<FoodRecognitionResult> {
  // 1. 预处理图片
  let processedBuffer: Buffer;
  try {
    processedBuffer = await preprocessImage(imageBuffer);
  } catch (err) {
    logger.warn('logmeal: image preprocessing failed, using original', { err });
    processedBuffer = imageBuffer;
  }

  // 2. 构建 multipart/form-data（Node.js 18+ 原生 FormData）
  const formData = new FormData();
  const blob = new Blob([processedBuffer], { type: 'image/jpeg' });
  formData.append('image', blob, 'food.jpg');

  const apiKey = config.ai.apiKey || 'c2c524a7ed34ad36fd4dd124eebda1f4d74321d8';
  const apiUrl = config.ai.apiUrl || 'https://api.logmeal.es';

  // 3. 调用 LogMeal API
  try {
    const response = await axios.post<LogMealResponse>(
      `${apiUrl}/v2/image/segmentation/complete/v1.0`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: API_TIMEOUT_MS,
      }
    );

    logger.debug('logmeal: recognition response received', {
      status: response.status,
      segmentCount: response.data.segmentation_results?.length ?? 0,
    });

    // 4. 解析结果
    return parseLogMealResponse(response.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        logger.error('logmeal: API timeout', { timeout: API_TIMEOUT_MS });
        // 超时抛出，由 controller 返回 503
        throw Object.assign(new Error('LogMeal API timeout'), {
          code: 'AI_TIMEOUT',
        });
      }
      logger.error('logmeal: API error', {
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      logger.error('logmeal: unexpected error', { err });
    }
    throw err;
  }
}
