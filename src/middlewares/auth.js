import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export async function jwtAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ status: false, data: { pesan: 'Unauthorized' } });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
    const user = await User.findById(payload.uid);
    if (!user) return res.status(401).json({ status: false, data: { pesan: 'Unauthorized' } });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ status: false, data: { pesan: 'Unauthorized' } });
  }
}
