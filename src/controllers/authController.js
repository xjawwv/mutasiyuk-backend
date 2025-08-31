import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dayjs from 'dayjs';
import { User } from '../models/User.js';

export async function register(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ status: false, data: { pesan: 'Email & password diperlukan' } });
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ status: false, data: { pesan: 'Email sudah terdaftar' } });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, settings: { webhookSecret: crypto.randomBytes(16).toString('hex') } });
  return res.json({ status: true, data: { userId: user._id } });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ status: false, data: { pesan: 'Invalid credentials' } });
  const ok = await bcrypt.compare(password, user.passwordHash || '');
  if (!ok) return res.status(401).json({ status: false, data: { pesan: 'Invalid credentials' } });
  const token = jwt.sign({ uid: user._id }, process.env.JWT_SECRET || 'dev', { expiresIn: '7d' });
  return res.json({ status: true, data: { token } });
}
