import { type IRouter, Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '@/middleware/auth.middleware';
import { FoodController } from '@/controllers/food.controller';

const router: IRouter = Router();

// 图片上传：内存存储，限制 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_IMAGE'));
    }
  },
});

/**
 * @route POST /api/food/recognize
 * @desc 上传图片，调用 LogMeal 识别食物
 * @access Private
 */
router.post(
  '/recognize',
  authenticateToken,
  upload.single('image'),
  FoodController.recognize
);

/**
 * @route POST /api/food/records
 * @desc 保存饮食记录
 * @access Private
 */
router.post('/records', authenticateToken, FoodController.createRecord);

/**
 * @route GET /api/food/records
 * @desc 获取饮食记录（可选 ?date=YYYY-MM-DD）
 * @access Private
 */
router.get('/records', authenticateToken, FoodController.getRecords);

/**
 * @route DELETE /api/food/records/:id
 * @desc 删除饮食记录
 * @access Private
 */
router.delete('/records/:id', authenticateToken, FoodController.deleteRecord);

/**
 * @route GET /api/food/stats
 * @desc 获取 N 天营养统计（可选 ?days=7）
 * @access Private
 */
router.get('/stats', authenticateToken, FoodController.getStats);

export default router;
