import { customAlphabet } from 'nanoid';
const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
export function generateKodeDeposit() { return 'MY' + nano(); }
