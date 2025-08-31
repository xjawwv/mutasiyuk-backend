import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { apiKeyAuth } from '../middlewares/apiKeyAuth.js';
import { checkSubscription } from '../middlewares/checkSubscription.js';
import { createDeposit, cancelDeposit, getDepositStatus } from '../controllers/depositController.js';

const router = Router();

// Semua endpoint v1 pakai API key + subscription aktif
router.use(apiKeyAuth, checkSubscription);

// Rate limiter khusus cek status deposit
const statusLimiter = rateLimit({
  windowMs: 5000, // 5 detik
  max: 1,         // hanya 1x/5 detik per user+kodeDeposit
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = req.user?._id?.toString() || 'anon';
    const kode = req.params?.kodeDeposit || 'none';
    return `${uid}:${kode}`;
  },
  handler: (_req, res) =>
    res.status(429).json({
      status: false,
      data: { pesan: 'Terlalu sering cek status. Coba lagi dalam 5 detik.' }
    })
});

// Endpoint deposit
router.post('/deposits', createDeposit);
router.post('/deposits/:kodeDeposit/cancel', cancelDeposit);
router.get('/deposits/:kodeDeposit', statusLimiter, getDepositStatus);

// Endpoint untuk cek status subscription via API key
router.get('/subscription', (req, res) => {
  const u = req.user;
  const active = !!(u.subscription_expires_at && u.subscription_expires_at > new Date());
  res.json({
    status: true,
    data: {
      active,
      expires_at: u.subscription_expires_at
    }
  });
});

export default router;
