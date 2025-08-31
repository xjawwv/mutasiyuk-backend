import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { jwtAuth } from '../middlewares/auth.js';
import { createSubscriptionOrder, getSubscriptionOrderStatus, getMySubscription } from '../controllers/subscriptionController.js';

const router = Router();

// Semua endpoint subscription pakai JWT (user login), tidak pakai API key
router.use(jwtAuth);

// Buat order baru
router.post('/order', createSubscriptionOrder);

// Cek status order (rate limit 1x/5s per user+order)
const statusLimiter = rateLimit({
  windowMs: 5000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = req.user?._id?.toString() || 'anon';
    const oid = req.params?.orderId || 'none';
    return `${uid}:${oid}`;
  },
  handler: (_req, res) =>
    res
      .status(429)
      .json({ status: false, data: { pesan: 'Terlalu sering cek status. Coba lagi dalam 5 detik.' } }),
});

router.get('/order/:orderId', statusLimiter, getSubscriptionOrderStatus);

// Cek masa aktif subscription
router.get('/me', getMySubscription);

export default router;
