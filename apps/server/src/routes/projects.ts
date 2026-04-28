import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { ProjectWithNodes, CreateProjectBody } from '@mindmap/shared';

const projects = new Hono();

projects.get('/', (c) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  return c.json(rows);
});

projects.post('/', async (c) => {
  const body = await c.req.json<CreateProjectBody>();
  const id = uuid();
  const db = getDb();

  const projectId = db.transaction(() => {
    db.prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id, body.name);
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
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(c.req.param('id'));
  if (!project) return c.json({ error: 'Not found' }, 404);

  const nodes = db.prepare('SELECT * FROM nodes WHERE project_id = ? ORDER BY sort_order').all(c.req.param('id'));
  return c.json({ ...project, nodes } as ProjectWithNodes);
});

projects.delete('/:id', (c) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(c.req.param('id'));
  return c.json({ ok: true });
});

export default projects;
