import { Router } from 'express';
import { jwtAuth } from '../middlewares/auth.js';
import { me, getSettings, updateSettings, rotateApiKey } from '../controllers/userController.js';

const router = Router();
router.use(jwtAuth);
router.get('/', me);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/api-key/rotate', rotateApiKey);
export default router;
