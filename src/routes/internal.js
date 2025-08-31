import { Router } from 'express';
import { subscriptionWebhook } from '../controllers/internalController.js';
import { ipWhitelist } from '../middlewares/ipWhitelist.js';
import { WebhookLog } from '../models/WebhookLog.js';

const router = Router();

const whitelistEnv = (process.env.SUBS_WEBHOOK_WHITELIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Webhook endpoint (protected by IP whitelist)
router.post('/subscription/webhook', ipWhitelist(whitelistEnv), subscriptionWebhook);

// ===== Logs (protected) =====

// GET /internal/webhook/logs?limit=50&processed=true&since=ISO&order_id=SUBXXXX&sourceUser=xjaww
router.get('/webhook/logs', ipWhitelist(whitelistEnv), async (req, res) => {
  try {
    const maxReturn = parseInt(process.env.SUBS_WEBHOOK_LOG_MAX_RETURN || '200', 10);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), maxReturn);

    const filter = {};
    if (req.query.processed === 'true') filter.processed = true;
    if (req.query.processed === 'false') filter.processed = false;
    if (req.query.order_id) filter.matched_order_id = String(req.query.order_id);
    if (req.query.since) filter.createdAt = { $gte: new Date(String(req.query.since)) };
    if (req.query.sourceUser) filter['body.sourceUser'] = String(req.query.sourceUser);

    const rows = await WebhookLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ status: true, data: rows });
  } catch (e) {
    res.status(500).json({ status: false, data: { pesan: 'Gagal ambil logs' } });
  }
});

// GET /internal/webhook/logs/:id
router.get('/webhook/logs/:id', ipWhitelist(whitelistEnv), async (req, res) => {
  try {
    const row = await WebhookLog.findById(req.params.id).lean();
    if (!row) return res.status(404).json({ status: false, data: { pesan: 'Log tidak ditemukan' } });
    res.json({ status: true, data: row });
  } catch {
    res.status(500).json({ status: false, data: { pesan: 'Gagal ambil log' } });
  }
});

export default router;
