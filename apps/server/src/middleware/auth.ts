import { createMiddleware } from 'hono/factory';
import { verifyToken } from '../auth.js';

interface AuthEnv {
  Variables: {
    userId: string;
    username: string;
  };
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', payload.userId);
  c.set('username', payload.username);
  await next();
});
