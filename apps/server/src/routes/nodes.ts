import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { CreateNodeBody, UpdateNodeBody, UpdatePositionBody, ReorderBody } from '@tasktree/shared';

type AuthVars = { Variables: { userId: string; username: string } };
const nodes = new Hono<AuthVars>();

// Helper: verify the project belongs to the current user
function verifyProjectOwnership(db: ReturnType<typeof getDb>, projectId: string, userId: string): boolean {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return !!project;
}

// Helper: verify node ownership via its project
function verifyNodeOwnership(db: ReturnType<typeof getDb>, nodeId: string, userId: string): boolean {
  const node = db.prepare('SELECT project_id FROM nodes WHERE id = ?').get(nodeId) as { project_id: string } | undefined;
  if (!node) return false;
  return verifyProjectOwnership(db, node.project_id, userId);
}

/**
 * Bottom-up cascade: derive parent status from children.
 * Rules:
 *   - Any active/pending child → parent active
 *   - All children concluded (done/dropped) → parent done
 *   - Never auto-drop a parent (dropped only spreads top-down)
 *   - No children → unchanged (leaf node, manual control)
 */
function cascadeUp(db: ReturnType<typeof getDb>, nodeId: string) {
  const node = db.prepare('SELECT parent_id FROM nodes WHERE id = ?').get(nodeId) as { parent_id: string | null } | undefined;
  if (!node || !node.parent_id) return; // root, stop

  const siblings = db.prepare('SELECT status FROM nodes WHERE parent_id = ?').all(node.parent_id) as { status: string }[];
  if (siblings.length === 0) return;

  let newStatus: string;
  if (siblings.some(s => s.status === 'active' || s.status === 'pending')) {
    newStatus = 'active';
  } else {
    // All done/dropped → parent done (never dropped from bottom-up)
    newStatus = 'done';
  }

  const parent = db.prepare('SELECT status FROM nodes WHERE id = ?').get(node.parent_id) as { status: string } | undefined;
  if (parent && parent.status !== newStatus) {
    db.prepare('UPDATE nodes SET status = ? WHERE id = ?').run(newStatus, node.parent_id);
    cascadeUp(db, node.parent_id);
  }
}

/**
 * Top-down cascade: when parent is dropped, drop all descendants.
 * Dropped only spreads downward by explicit user action.
 */
function cascadeDown(db: ReturnType<typeof getDb>, parentId: string) {
  const children = db.prepare('SELECT id FROM nodes WHERE parent_id = ?').all(parentId) as { id: string }[];
  for (const child of children) {
    db.prepare('UPDATE nodes SET status = ? WHERE id = ?').run('dropped', child.id);
    cascadeDown(db, child.id);
  }
}

nodes.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<CreateNodeBody>();
  const id = uuid();
  const db = getDb();

  if (!verifyProjectOwnership(db, body.project_id, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

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

  // If parent was done/dropped, reactivate it
  if (body.parent_id) {
    const parentNode = db.prepare('SELECT status FROM nodes WHERE id = ?').get(body.parent_id) as { status: string } | undefined;
    if (parentNode && (parentNode.status === 'done' || parentNode.status === 'dropped')) {
      db.prepare('UPDATE nodes SET status = ? WHERE id = ?').run('active', body.parent_id);
      cascadeUp(db, body.parent_id);
    }
  }

  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
  return c.json(node, 201);
});

nodes.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<UpdateNodeBody>();
  const db = getDb();
  const nodeId = c.req.param('id');

  if (!verifyNodeOwnership(db, nodeId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { sets.push('title = ?'); values.push(body.title); }
  if (body.notes !== undefined) { sets.push('notes = ?'); values.push(body.notes); }
  if (body.status !== undefined) { sets.push('status = ?'); values.push(body.status); }
  if (body.edge_label !== undefined) { sets.push('edge_label = ?'); values.push(body.edge_label); }
  if (body.parent_id !== undefined) { sets.push('parent_id = ?'); values.push(body.parent_id); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(nodeId);
  db.prepare(`UPDATE nodes SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  // Cascade status propagation if status was changed
  if (body.status !== undefined) {
    if (body.status === 'dropped') {
      cascadeDown(db, nodeId);
    }
    cascadeUp(db, nodeId);
  }

  // If moved to a new parent, cascade both old and new parent
  if (body.parent_id !== undefined) {
    cascadeUp(db, nodeId);
    if (body.parent_id) {
      // Reactivate new parent if it was done/dropped
      const newParent = db.prepare('SELECT status FROM nodes WHERE id = ?').get(body.parent_id) as { status: string } | undefined;
      if (newParent && (newParent.status === 'done' || newParent.status === 'dropped')) {
        db.prepare('UPDATE nodes SET status = ? WHERE id = ?').run('active', body.parent_id);
        cascadeUp(db, body.parent_id);
      }
    }
  }

  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
  return c.json(node);
});

nodes.patch('/:id/position', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<UpdatePositionBody>();
  const db = getDb();
  const nodeId = c.req.param('id');

  if (!verifyNodeOwnership(db, nodeId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  db.prepare('UPDATE nodes SET position_x = ?, position_y = ? WHERE id = ?')
    .run(body.position_x, body.position_y, nodeId);

  return c.json({ ok: true });
});

nodes.delete('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const nodeId = c.req.param('id');

  if (!verifyNodeOwnership(db, nodeId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Get parent before deleting so we can cascade
  const node = db.prepare('SELECT parent_id FROM nodes WHERE id = ?').get(nodeId) as { parent_id: string | null } | undefined;
  // CASCADE will delete descendants
  db.prepare('DELETE FROM nodes WHERE id = ?').run(nodeId);
  // Re-evaluate parent status after deletion
  if (node?.parent_id) {
    cascadeUp(db, node.parent_id);
  }
  return c.json({ ok: true });
});

nodes.post('/:id/reorder', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<ReorderBody>();
  const db = getDb();
  const nodeId = c.req.param('id');

  if (!verifyNodeOwnership(db, nodeId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  db.prepare('UPDATE nodes SET sort_order = ? WHERE id = ?')
    .run(body.sort_order, nodeId);

  return c.json({ ok: true });
});

export default nodes;
