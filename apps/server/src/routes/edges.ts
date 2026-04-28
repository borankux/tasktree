import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { CreateEdgeBody, UpdateEdgeBody } from '@tasktree/shared';

type AuthVars = { Variables: { userId: string; username: string } };
const edges = new Hono<AuthVars>();

// Helper: verify project ownership
function verifyProjectOwnership(db: ReturnType<typeof getDb>, projectId: string, userId: string): boolean {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return !!project;
}

// Helper: verify edge ownership via its project
function verifyEdgeOwnership(db: ReturnType<typeof getDb>, edgeId: string, userId: string): boolean {
  const edge = db.prepare('SELECT project_id FROM edges WHERE id = ?').get(edgeId) as { project_id: string } | undefined;
  if (!edge) return false;
  return verifyProjectOwnership(db, edge.project_id, userId);
}

edges.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<CreateEdgeBody>();
  const id = uuid();
  const db = getDb();

  if (!verifyProjectOwnership(db, body.project_id, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  db.prepare(
    `INSERT INTO edges (id, project_id, source_id, target_id, label, edge_type, style)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, body.project_id, body.source_id, body.target_id, body.label || '',
    body.edge_type || 'relates_to', body.style || '{}');

  const edge = db.prepare('SELECT * FROM edges WHERE id = ?').get(id);
  return c.json(edge, 201);
});

edges.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<UpdateEdgeBody>();
  const db = getDb();
  const id = c.req.param('id');

  if (!verifyEdgeOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.label !== undefined) { sets.push('label = ?'); values.push(body.label); }
  if (body.edge_type !== undefined) { sets.push('edge_type = ?'); values.push(body.edge_type); }
  if (body.style !== undefined) { sets.push('style = ?'); values.push(body.style); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(id);
  db.prepare(`UPDATE edges SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const edge = db.prepare('SELECT * FROM edges WHERE id = ?').get(id);
  return c.json(edge);
});

edges.delete('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');

  if (!verifyEdgeOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  db.prepare('DELETE FROM edges WHERE id = ?').run(id);
  return c.json({ ok: true });
});

export default edges;
