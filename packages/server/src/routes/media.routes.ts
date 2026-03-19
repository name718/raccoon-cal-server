import { type IRouter, Router } from 'express';
import { FoodController } from '@/controllers/food.controller';

const router: IRouter = Router();

router.get('/:encodedKey', FoodController.proxyRecordImage);

export default router;
