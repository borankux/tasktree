import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { ProjectWithNodes, CreateProjectBody } from '@tasktree/shared';

type AuthVars = { Variables: { userId: string; username: string } };
const projects = new Hono<AuthVars>();

projects.get('/', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  return c.json(rows);
});

projects.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<CreateProjectBody>();
  const id = uuid();
  const db = getDb();

  const projectId = db.transaction(() => {
    db.prepare('INSERT INTO projects (id, name, user_id) VALUES (?, ?, ?)').run(id, body.name, userId);
    // auto-create root node
    const nodeId = uuid();
    db.prepare(
      `INSERT INTO nodes (id, project_id, parent_id, title, sort_order) VALUES (?, ?, NULL, ?, 0)`
    ).run(nodeId, id, body.name);
    return id;
  })();

  return c.json({ id: projectId, name: body.name }, 201);
});

projects.get('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(c.req.param('id'), userId);
  if (!project) return c.json({ error: 'Not found' }, 404);

  const nodes = db.prepare('SELECT * FROM nodes WHERE project_id = ? ORDER BY sort_order').all(c.req.param('id'));
  const edges = db.prepare('SELECT * FROM edges WHERE project_id = ?').all(c.req.param('id'));
  const tags = db.prepare('SELECT * FROM tags WHERE project_id = ?').all(c.req.param('id'));
  const projectViews = db.prepare('SELECT * FROM views WHERE project_id = ? ORDER BY sort_order, created_at').all(c.req.param('id'));
  return c.json({ ...project, nodes, edges, tags, views: projectViews } as ProjectWithNodes);
});

projects.delete('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const result = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(c.req.param('id'), userId);
  if (result.changes === 0) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

export default projects;
