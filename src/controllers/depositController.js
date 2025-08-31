import dayjs from 'dayjs';
import { Deposit } from '../models/Deposit.js';
import { generateQris } from '../services/providerService.js';
import { generateKodeDeposit } from '../utils/idGen.js';

function fmtDate(d) { return dayjs(d).format('YYYY-MM-DD HH:mm'); }

async function pickUniqueCode(userId, maxCode) {
  const active = await Deposit.find({ userId, status: 'Pending' }, { unique_code: 1 }).lean();
  const used = new Set(active.map(d => d.unique_code));
  for (let code = 1; code <= maxCode; code++) { if (!used.has(code)) return code; }
  return null;
}

export async function createDeposit(req, res) {
  const user = req.user;
  try {
    const { nominal } = req.body || {};
    const n = parseInt(nominal, 10);
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ status: false, data: { pesan: 'Nominal tidak valid' } });
    if (!user.settings?.qrisBase || !user.settings?.kodeMerchant || !user.settings?.username || !user.settings?.token) {
      return res.status(400).json({ status: false, data: { pesan: 'Settings belum lengkap' } });
    }
    const ttlMin = parseInt(process.env.DEPOSIT_TTL_MINUTES || '15', 10);
    const maxCode = user.settings?.unique_code_max_value || parseInt(process.env.UNIQUE_CODE_MAX_DEFAULT || '100', 10);
    const code = await pickUniqueCode(user._id, maxCode);
    if (!code) return res.status(409).json({ status: false, data: { pesan: 'Semua kode unik sedang terpakai, coba beberapa menit lagi' } });
    const saldo_didapat = n + code;

    const q = await generateQris(user.settings.qrisBase, saldo_didapat);
    if (!q?.success) return res.status(502).json({ status: false, data: { pesan: 'Gagal generate QRIS' } });

    const kode_deposit = generateKodeDeposit();
    const deposit = await Deposit.create({
      userId: user._id, kode_deposit, nominal: n, unique_code: code, saldo_didapat,
      status: 'Pending', expiredAt: dayjs().add(ttlMin, 'minute').toDate(),
      link_qr: q?.data?.image_url || q?.data?.imageUrl || null, qris_image_url: q?.data?.image_url || null
    });

    return res.json({ status: true, data: {
      kode_deposit: deposit.kode_deposit,
      kode_merchant: user.settings.kodeMerchant,
      metode: 'QRIS',
      nominal: deposit.nominal,
      kode_unik: deposit.unique_code,
      saldo_didapat: deposit.saldo_didapat,
      status: deposit.status,
      expired: fmtDate(deposit.expiredAt),
      link_qr: deposit.link_qr
    }});
  } catch (e) {
    console.error('createDeposit error', e);
    return res.status(500).json({ status: false, data: { pesan: 'Terjadi kesalahan' } });
  }
}

export async function cancelDeposit(req, res) {
  const user = req.user;
  try {
    const { kodeDeposit } = req.params;
    const dep = await Deposit.findOne({ userId: user._id, kode_deposit: kodeDeposit });
    if (!dep) return res.status(404).json({ status: false, data: { pesan: 'Deposit tidak ditemukan' } });
    if (dep.status === 'Success') return res.status(409).json({ status: false, data: { pesan: 'Deposit sudah Success' } });

    if (dep.status === 'Cancelled' || dep.status === 'Expired') {
      // idempotent: return same
    } else {
      dep.status = 'Cancelled';
      await dep.save();
    }
    return res.json({ status: true, data: {
      kode_deposit: dep.kode_deposit, status: 'cancelled', "Nominal": String(dep.saldo_didapat)
    }});
  } catch (e) {
    return res.status(500).json({ status: false, data: { pesan: 'Terjadi kesalahan' } });
  }
}

export async function getDepositStatus(req, res) {
  const user = req.user;
  try {
    const { kodeDeposit } = req.params;
    const dep = await Deposit.findOne({ userId: user._id, kode_deposit: kodeDeposit });
    if (!dep) return res.status(404).json({ status: false, data: { pesan: 'Deposit tidak ditemukan' } });

    if (dep.status === 'Success') {
      return res.json({ status: true, data: {
        kode_deposit: dep.kode_deposit, status: 'Success',
        "Nominal": String(dep.saldo_didapat), "kode_unik": dep.unique_code,
        detail_pengirim: dep.detail_pengirim || (dep.brand?.name || 'N/A')
      }});
    }
    return res.json({ status: true, data: {
      kode_deposit: dep.kode_deposit, status: dep.status,
      "Nominal": String(dep.saldo_didapat), "kode_unik": dep.unique_code
    }});
  } catch {
    return res.status(500).json({ status: false, data: { pesan: 'Terjadi kesalahan' } });
  }
}
