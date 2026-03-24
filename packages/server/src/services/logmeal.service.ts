import axios from 'axios';
import sharp from 'sharp';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export interface RecognizedFood {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  servingSize: number;
  mealType?: string;
}

export interface FoodRecognitionResult {
  foods: RecognizedFood[];
  confidence: number;
}

interface LogMealSegment {
  recognition_results?: Array<{
    name?: string;
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
}

interface BaiduDishItem {
  name?: string;
  calorie?: string | number;
  probability?: string | number;
  has_calorie?: boolean;
}

interface BaiduDishResponse {
  error_code?: number;
  error_msg?: string;
  result_num?: number;
  result?: BaiduDishItem[];
}

interface BaiduTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

const CONFIDENCE_THRESHOLD = 0.3;
const IMAGE_MAX_WIDTH = 800;
const IMAGE_JPEG_QUALITY = 80;
const DEFAULT_SERVING_SIZE = 100;
const BAIDU_NON_FOOD_LABELS = new Set([
  '非菜',
  '非菜品',
  '非食物',
  '其他类',
  '其他',
]);

let baiduTokenCache: {
  accessToken: string;
  expiresAt: number;
} | null = null;

export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: IMAGE_JPEG_QUALITY })
    .toBuffer();
}

function parseLogMealResponse(data: LogMealResponse): FoodRecognitionResult {
  const segments = data.segmentation_results ?? [];

  if (segments.length === 0) {
    return { foods: [], confidence: 0 };
  }

  const foods: RecognizedFood[] = [];
  let totalConfidence = 0;
  let count = 0;

  const defaultMealType = inferMealTypeByCurrentTime();
  for (const segment of segments) {
    const results = segment.recognition_results ?? [];
    for (const item of results) {
      const prob = item.prob ?? 0;
      totalConfidence += prob;
      count += 1;

      if (prob < CONFIDENCE_THRESHOLD) {
        continue;
      }

      const nutrients = item.nutritional_info?.totalNutrients;
      foods.push({
        name: item.name ?? 'Unknown food',
        calories: item.nutritional_info?.calories ?? 0,
        protein: nutrients?.PROCNT?.quantity ?? 0,
        fat: nutrients?.FAT?.quantity ?? 0,
        carbs: nutrients?.CHOCDF?.quantity ?? 0,
        servingSize: DEFAULT_SERVING_SIZE,
        mealType: defaultMealType,
      });
    }
  }

  const avgConfidence = count > 0 ? totalConfidence / count : 0;
  if (avgConfidence < CONFIDENCE_THRESHOLD) {
    return { foods: [], confidence: 0 };
  }

  return { foods, confidence: avgConfidence };
}

function inferMealTypeByCurrentTime(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

function parseBaiduNumber(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  const direct = Number(normalized);
  if (Number.isFinite(direct)) {
    return direct;
  }

  const matched = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!matched) {
    return 0;
  }

  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBaiduDishResponse(
  data: BaiduDishResponse
): FoodRecognitionResult {
  if (data.error_code) {
    const error = new Error(data.error_msg || '百度菜品识别失败');
    (error as Error & { code?: string }).code = 'BAIDU_AI_ERROR';
    throw error;
  }

  const results = data.result ?? [];
  if (results.length === 0) {
    return { foods: [], confidence: 0 };
  }

  const defaultMealType = inferMealTypeByCurrentTime();
  const rankedResults = results
    .map(item => ({
      name: item.name?.trim() || '未知菜品',
      probability: parseBaiduNumber(item.probability),
      calories: parseBaiduNumber(item.calorie),
    }))
    .filter(item => item.name.length > 0)
    .sort((left, right) => right.probability - left.probability);

  const dedupedResults = rankedResults
    .filter((item, index, array) => {
      return (
        array.findIndex(candidate => candidate.name === item.name) === index
      );
    })
    .filter(item => !BAIDU_NON_FOOD_LABELS.has(item.name))
    .slice(0, config.ai.baidu.topNum);

  if (dedupedResults.length === 0) {
    return { foods: [], confidence: 0 };
  }

  const foods: RecognizedFood[] = dedupedResults.map(item => ({
    name: item.name,
    calories: item.calories,
    protein: 0,
    fat: 0,
    carbs: 0,
    servingSize: DEFAULT_SERVING_SIZE,
    mealType: defaultMealType,
  }));

  const confidence = dedupedResults[0]?.probability ?? 0;

  return {
    foods: confidence >= CONFIDENCE_THRESHOLD ? foods : [],
    confidence: confidence >= CONFIDENCE_THRESHOLD ? confidence : 0,
  };
}

function getAiTimeoutMs(): number {
  return config.ai.timeoutMs || 10_000;
}

function ensureBaiduConfig() {
  const { apiKey, secretKey } = config.ai.baidu;
  if (!apiKey || !secretKey) {
    const error = new Error(
      '百度菜品识别配置不完整，请检查 BAIDU_AI_API_KEY / BAIDU_AI_SECRET_KEY'
    );
    (error as Error & { code?: string }).code = 'BAIDU_AI_CONFIG_MISSING';
    throw error;
  }
}

async function getBaiduAccessToken(): Promise<string> {
  ensureBaiduConfig();

  const now = Date.now();
  if (baiduTokenCache && baiduTokenCache.expiresAt > now + 60_000) {
    return baiduTokenCache.accessToken;
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.ai.baidu.apiKey as string,
      client_secret: config.ai.baidu.secretKey as string,
    });

    const response = await axios.post<BaiduTokenResponse>(
      config.ai.baidu.oauthUrl,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: getAiTimeoutMs(),
      }
    );

    const accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in ?? 2_592_000;

    if (!accessToken) {
      throw new Error(
        response.data.error_description ||
          response.data.error ||
          '获取百度 access_token 失败'
      );
    }

    baiduTokenCache = {
      accessToken,
      expiresAt: now + expiresIn * 1000,
    };

    return accessToken;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const error = new Error('百度鉴权失败，请检查 API Key / Secret Key');
      (error as Error & { code?: string; details?: unknown }).code =
        'BAIDU_AI_AUTH_FAILED';
      (error as Error & { code?: string; details?: unknown }).details =
        err.response.data;
      throw error;
    }

    logger.error('baidu.ai: failed to get access token', {
      err,
    });
    throw err;
  }
}

async function recognizeWithLogMeal(
  processedBuffer: Buffer
): Promise<FoodRecognitionResult> {
  const formData = new FormData();
  const blob = new Blob([processedBuffer], { type: 'image/jpeg' });
  formData.append('image', blob, 'food.jpg');

  const apiKey = config.ai.logmeal.apiKey;
  const apiUrl = config.ai.logmeal.apiUrl;

  if (!apiKey) {
    const error = new Error('LogMeal API Key 未配置');
    (error as Error & { code?: string }).code = 'AI_CONFIG_MISSING';
    throw error;
  }

  const response = await axios.post<LogMealResponse>(
    `${apiUrl}/v2/image/segmentation/complete/v1.0`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: getAiTimeoutMs(),
    }
  );

  logger.debug('logmeal: recognition response received', {
    status: response.status,
    segmentCount: response.data.segmentation_results?.length ?? 0,
  });

  return parseLogMealResponse(response.data);
}

async function recognizeWithBaidu(
  processedBuffer: Buffer
): Promise<FoodRecognitionResult> {
  const accessToken = await getBaiduAccessToken();
  const params = new URLSearchParams();
  params.set('image', processedBuffer.toString('base64'));
  params.set('top_num', String(config.ai.baidu.topNum));
  params.set('filter_threshold', String(config.ai.baidu.filterThreshold));
  params.set('baike_num', String(config.ai.baidu.baikeNum));

  const response = await axios.post<BaiduDishResponse>(
    `${config.ai.baidu.dishUrl}?access_token=${encodeURIComponent(accessToken)}`,
    params.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: getAiTimeoutMs(),
    }
  );

  logger.debug('baidu.ai: dish recognition response received', {
    resultNum: response.data.result_num ?? 0,
    provider: 'baidu',
    appId: config.ai.baidu.appId,
  });

  return parseBaiduDishResponse(response.data);
}

export async function recognizeFood(
  imageBuffer: Buffer
): Promise<FoodRecognitionResult> {
  let processedBuffer: Buffer;
  try {
    processedBuffer = await preprocessImage(imageBuffer);
  } catch (err) {
    logger.warn('food.ai: image preprocessing failed, using original', { err });
    processedBuffer = imageBuffer;
  }

  try {
    if (config.ai.provider === 'baidu') {
      return await recognizeWithBaidu(processedBuffer);
    }

    return await recognizeWithLogMeal(processedBuffer);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        logger.error('food.ai: API timeout', {
          provider: config.ai.provider,
          timeout: getAiTimeoutMs(),
        });
        throw Object.assign(new Error('Food AI timeout'), {
          code: 'AI_TIMEOUT',
        });
      }

      logger.error('food.ai: provider request failed', {
        provider: config.ai.provider,
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      logger.error('food.ai: unexpected recognition error', {
        provider: config.ai.provider,
        err,
      });
    }

    throw err;
  }
}
