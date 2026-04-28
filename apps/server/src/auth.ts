import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'tasktree-dev-secret-change-in-prod';
const SCRYPT_KEYLEN = 32;
const CAPTCHA_THRESHOLD = 10;

// --- Password hashing (scrypt) ---

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey));
    });
  });
}

// --- JWT (HMAC-SHA256) ---

interface JWTPayload {
  userId: string;
  username: string;
}

export function signToken(payload: JWTPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): JWTPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.userId || !payload.username) return null;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

// --- Failed login tracking (in-memory) ---

const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

export function recordFailedAttempt(username: string): number {
  const entry = failedAttempts.get(username);
  const count = (entry?.count ?? 0) + 1;
  failedAttempts.set(username, { count, lastAttempt: Date.now() });
  return count;
}

export function clearFailedAttempts(username: string): void {
  failedAttempts.delete(username);
}

export function needsCaptcha(username: string): boolean {
  const entry = failedAttempts.get(username);
  if (!entry) return false;
  // Reset after 30 minutes of no attempts
  if (Date.now() - entry.lastAttempt > 30 * 60 * 1000) {
    failedAttempts.delete(username);
    return false;
  }
  return entry.count >= CAPTCHA_THRESHOLD;
}

// --- Math captcha SVG ---

const captchaStore = new Map<string, { answer: string; expires: number }>();

export function generateCaptcha(username: string): { captchaId: string; svg: string } {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const answer = String(a + b);
  const captchaId = crypto.randomBytes(8).toString('hex');

  captchaStore.set(captchaId, { answer, expires: Date.now() + 5 * 60 * 1000 });
  // Also tie to username
  captchaStore.set(`${captchaId}:${username}`, { answer, expires: Date.now() + 5 * 60 * 1000 });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
    <rect width="120" height="40" fill="#f0f0f0" rx="4"/>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="20" fill="#333" font-weight="bold">${a} + ${b} = ?</text>
  </svg>`;

  return { captchaId, svg };
}

export function verifyCaptcha(captchaId: string, username: string, answer: string): boolean {
  const entry = captchaStore.get(`${captchaId}:${username}`);
  if (!entry) return false;
  if (Date.now() > entry.expires) {
    captchaStore.delete(`${captchaId}:${username}`);
    captchaStore.delete(captchaId);
    return false;
  }
  const valid = entry.answer === answer.trim();
  captchaStore.delete(`${captchaId}:${username}`);
  captchaStore.delete(captchaId);
  return valid;
}
