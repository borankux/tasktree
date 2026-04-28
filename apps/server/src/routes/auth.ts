import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import { hashPassword, verifyPassword, signToken, needsCaptcha, recordFailedAttempt, clearFailedAttempts, generateCaptcha, verifyCaptcha } from '../auth.js';
import type { RegisterBody, LoginBody } from '@tasktree/shared';

const auth = new Hono();

// POST /api/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json<RegisterBody>();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }
  if (username.length < 2 || username.length > 32) {
    return c.json({ error: 'Username must be 2-32 characters' }, 400);
  }
  if (password.length < 4) {
    return c.json({ error: 'Password must be at least 4 characters' }, 400);
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return c.json({ error: 'Username already taken' }, 409);
  }

  const id = uuid();
  const hash = await hashPassword(password);
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username, hash);

  const token = signToken({ userId: id, username });
  return c.json({ token, user: { id, username, created_at: new Date().toISOString() } }, 201);
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json<LoginBody>();
  const { username, password, captcha_answer } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password are required' }, 400);
  }

  // Check captcha requirement
  if (needsCaptcha(username)) {
    if (!captcha_answer) {
      return c.json({ error: 'Captcha required', captchaRequired: true }, 400);
    }
    // Captcha verification happens client-side by passing captchaId + answer
    // We verify via a separate mechanism
  }

  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash, created_at FROM users WHERE username = ?').get(username) as
    | { id: string; username: string; password_hash: string; created_at: string }
    | undefined;

  if (!user) {
    recordFailedAttempt(username);
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const count = recordFailedAttempt(username);
    const response: Record<string, unknown> = { error: 'Invalid credentials' };
    if (count >= 10) response.captchaRequired = true;
    return c.json(response, 401);
  }

  clearFailedAttempts(username);
  const token = signToken({ userId: user.id, username: user.username });
  return c.json({
    token,
    user: { id: user.id, username: user.username, created_at: user.created_at },
  });
});

// GET /api/auth/captcha?username=xxx
auth.get('/captcha', (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ error: 'Username required' }, 400);

  const { captchaId, svg } = generateCaptcha(username);
  return c.json({ captcha_id: captchaId, svg, required: true });
});

// GET /api/auth/captcha-required?username=xxx
auth.get('/captcha-required', (c) => {
  const username = c.req.query('username');
  if (!username) return c.json({ required: false });
  return c.json({ required: needsCaptcha(username) });
});

// POST /api/auth/verify-captcha
auth.post('/verify-captcha', async (c) => {
  const { captcha_id, username, answer } = await c.req.json<{ captcha_id: string; username: string; answer: string }>();
  if (!captcha_id || !username || !answer) {
    return c.json({ valid: false }, 400);
  }
  const valid = verifyCaptcha(captcha_id, username, answer);
  if (valid) {
    clearFailedAttempts(username);
  }
  return c.json({ valid });
});

// GET /api/auth/me (protected)
auth.get('/me', async (c) => {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { verifyToken } = await import('../auth.js');
  const payload = verifyToken(header.slice(7));
  if (!payload) return c.json({ error: 'Invalid token' }, 401);

  const db = getDb();
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(payload.userId) as
    | { id: string; username: string; created_at: string }
    | undefined;

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({ user });
});

export default auth;
