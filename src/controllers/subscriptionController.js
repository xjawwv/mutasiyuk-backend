import dayjs from 'dayjs';
import { customAlphabet } from 'nanoid';
import { SubscriptionOrder } from '../models/SubscriptionOrder.js';
import { generateQris } from '../services/providerService.js';

const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
function fmt(d) { return dayjs(d).format('YYYY-MM-DD HH:mm'); }

/**
 * POST /subscription/order
 * JWT required (user login), tidak butuh API Key & tidak cek masa aktif (boleh beli kapanpun)
 * body: {}
 */
export async function createSubscriptionOrder(req, res) {
  try {
    const user = req.user;
    const price = parseInt(process.env.SUBS_PRICE || '10000', 10);
    const ttlMin = parseInt(process.env.SUBS_ORDER_TTL_MINUTES || '30', 10);
    const maxCode = parseInt(process.env.SUBS_UNIQUE_CODE_MAX_SUB || '100', 10);
    const qrisBase = process.env.SUBS_QRIS_BASE;

    if (!qrisBase) {
      return res.status(500).json({ status: false, data: { pesan: 'SUBS_QRIS_BASE belum diset di .env' } });
    }

    // 🔴 Batalkan order lama user yang masih Pending
    await SubscriptionOrder.updateMany(
      { userId: user._id, status: 'Pending' },
      { $set: { status: 'Cancelled', cancelledAt: new Date() } }
    );

    // 🎲 Cari kode unik random
    const pendingOrders = await SubscriptionOrder.find({ status: 'Pending' }, { unique_code: 1 }).lean();
    const usedCodes = new Set(pendingOrders.map(o => o.unique_code));

    let unique_code = null;
    for (let i = 0; i < 10 * maxCode; i++) {
      const candidate = Math.floor(Math.random() * maxCode) + 1;
      if (!usedCodes.has(candidate)) {
        unique_code = candidate;
        break;
      }
    }
    if (!unique_code) {
      return res.status(409).json({ status: false, data: { pesan: 'Semua kode unik sedang terpakai, coba beberapa menit lagi' } });
    }

    const amount = price + unique_code;

    // 🔗 generate QRIS ke provider admin
    const q = await generateQris(qrisBase, amount);
    if (!q?.success) {
      return res.status(502).json({ status: false, data: { pesan: 'Gagal generate QRIS subscription' } });
    }

    // 🚀 simpan order baru
    const order = await SubscriptionOrder.create({
      userId: user._id,
      order_id: 'SUB' + nano(),
      nominal: price,
      unique_code,
      amount,
      status: 'Pending',
      expiredAt: dayjs().add(ttlMin, 'minute').toDate(),
      qris_url: q?.data?.image_url || q?.data?.imageUrl || null
    });

    return res.json({
      status: true,
      data: {
        order_id: order.order_id,
        nominal: order.nominal,
        kode_unik: order.unique_code,
        amount: order.amount,
        status: order.status,
        expired: fmt(order.expiredAt),
        qris_url: order.qris_url
      }
    });
  } catch (e) {
    console.error('createSubscriptionOrder error', e);
    return res.status(500).json({ status: false, data: { pesan: 'Terjadi kesalahan' } });
  }
}

/**
 * GET /subscription/order/:orderId
 * JWT required
 */
export async function getSubscriptionOrderStatus(req, res) {
  try {
    const user = req.user;
    const { orderId } = req.params;
    const ord = await SubscriptionOrder.findOne({ userId: user._id, order_id: orderId });
    if (!ord) return res.status(404).json({ status: false, data: { pesan: 'Order tidak ditemukan' } });

    return res.json({
      status: true,
      data: {
        order_id: ord.order_id,
        status: ord.status,
        nominal: ord.nominal,
        kode_unik: ord.unique_code,
        amount: ord.amount,
        expired: fmt(ord.expiredAt),
        successAt: ord.successAt || null,
        qris_url: ord.qris_url
      }
    });
  } catch (e) {
    return res.status(500).json({ status: false, data: { pesan: 'Terjadi kesalahan' } });
  }
}

/**
 * GET /subscription/me
 * JWT required
 */
export async function getMySubscription(req, res) {
  const u = req.user;
  return res.json({
    status: true,
    data: {
      active: !!(u.subscription_expires_at && u.subscription_expires_at > new Date()),
      expires_at: u.subscription_expires_at
    }
  });
}
