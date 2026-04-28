import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { CreateNodeBody, UpdateNodeBody, UpdatePositionBody, ReorderBody } from '@mindmap/shared';

const nodes = new Hono();

nodes.post('/', async (c) => {
  const body = await c.req.json<CreateNodeBody>();
  const id = uuid();
  const db = getDb();

  // Get count of siblings for sort_order
  const siblings = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM nodes WHERE parent_id = ?'
  ).get(body.parent_id) as { next_order: number };

  // Default position: offset from parent
  const parent = body.parent_id
    ? db.prepare('SELECT position_x, position_y FROM nodes WHERE id = ?').get(body.parent_id) as { position_x: number; position_y: number }
    : null;

  const posX = parent ? parent.position_x + 250 : 0;
  const posY = parent ? parent.position_y + (siblings.next_order * 120) : 0;

  db.prepare(
    `INSERT INTO nodes (id, project_id, parent_id, title, position_x, position_y, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, body.project_id, body.parent_id, body.title, posX, posY, siblings.next_order);

  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
  return c.json(node, 201);
});

nodes.patch('/:id', async (c) => {
  const body = await c.req.json<UpdateNodeBody>();
  const db = getDb();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { sets.push('title = ?'); values.push(body.title); }
  if (body.notes !== undefined) { sets.push('notes = ?'); values.push(body.notes); }
  if (body.status !== undefined) { sets.push('status = ?'); values.push(body.status); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(c.req.param('id'));
  db.prepare(`UPDATE nodes SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(c.req.param('id'));
  return c.json(node);
});

nodes.patch('/:id/position', async (c) => {
  const body = await c.req.json<UpdatePositionBody>();
  const db = getDb();

  db.prepare('UPDATE nodes SET position_x = ?, position_y = ? WHERE id = ?')
    .run(body.position_x, body.position_y, c.req.param('id'));

  return c.json({ ok: true });
});

nodes.delete('/:id', (c) => {
  const db = getDb();
  // CASCADE will delete descendants
  db.prepare('DELETE FROM nodes WHERE id = ?').run(c.req.param('id'));
  return c.json({ ok: true });
});

nodes.post('/:id/reorder', async (c) => {
  const body = await c.req.json<ReorderBody>();
  const db = getDb();

  db.prepare('UPDATE nodes SET sort_order = ? WHERE id = ?')
    .run(body.sort_order, c.req.param('id'));

  return c.json({ ok: true });
});

export default nodes;
