import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { CreateViewBody, UpdateViewBody, AutoGenViewBody } from '@tasktree/shared';

interface ViewNodeInput {
  node_id: string;
  parent_id?: string | null;
  sort_order?: number;
  position_x?: number;
  position_y?: number;
  edge_label?: string;
}

type AuthVars = { Variables: { userId: string; username: string } };
const views = new Hono<AuthVars>();

function verifyProjectOwnership(db: ReturnType<typeof getDb>, projectId: string, userId: string): boolean {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return !!project;
}

function verifyViewOwnership(db: ReturnType<typeof getDb>, viewId: string, userId: string): boolean {
  const view = db.prepare('SELECT project_id FROM views WHERE id = ?').get(viewId) as { project_id: string } | undefined;
  if (!view) return false;
  return verifyProjectOwnership(db, view.project_id, userId);
}

// List views for a project
views.get('/project/:projectId', (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const db = getDb();

  if (!verifyProjectOwnership(db, projectId, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const result = db.prepare('SELECT * FROM views WHERE project_id = ? ORDER BY sort_order, created_at').all(projectId);
  return c.json(result);
});

// Get view with its node overrides
views.get('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');

  if (!verifyViewOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const view = db.prepare('SELECT * FROM views WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!view) return c.json({ error: 'Not found' }, 404);
  const viewNodes = db.prepare('SELECT * FROM view_nodes WHERE view_id = ?').all(id);
  return c.json({ ...view, view_nodes: viewNodes });
});

// Create view
views.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<CreateViewBody>();
  const id = uuid();
  const db = getDb();

  if (!verifyProjectOwnership(db, body.project_id, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  try {
    db.prepare(
      'INSERT INTO views (id, project_id, name, description, layout_config) VALUES (?, ?, ?, ?, ?)'
    ).run(id, body.project_id, body.name, body.description || '', body.layout_config || '{}');
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return c.json({ error: 'View name already exists in this project' }, 409);
    }
    throw err;
  }

  const view = db.prepare('SELECT * FROM views WHERE id = ?').get(id);
  return c.json(view, 201);
});

// Update view
views.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<UpdateViewBody>();
  const db = getDb();
  const id = c.req.param('id');

  if (!verifyViewOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); values.push(body.name); }
  if (body.description !== undefined) { sets.push('description = ?'); values.push(body.description); }
  if (body.layout_config !== undefined) { sets.push('layout_config = ?'); values.push(body.layout_config); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(id);
  try {
    db.prepare(`UPDATE views SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return c.json({ error: 'View name already exists' }, 409);
    }
    throw err;
  }

  const view = db.prepare('SELECT * FROM views WHERE id = ?').get(id);
  return c.json(view);
});

// Delete view
views.delete('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');

  if (!verifyViewOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  db.prepare('DELETE FROM views WHERE id = ?').run(id);
  return c.json({ ok: true });
});

// Save node positions for a view (batch upsert)
views.post('/:id/nodes', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const viewId = c.req.param('id');

  if (!verifyViewOwnership(db, viewId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const body = (await c.req.json()) as { nodes: ViewNodeInput[] };

  const upsert = db.prepare(`
    INSERT INTO view_nodes (view_id, node_id, parent_id, sort_order, position_x, position_y, edge_label)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(view_id, node_id) DO UPDATE SET
      parent_id = COALESCE(excluded.parent_id, view_nodes.parent_id),
      sort_order = COALESCE(excluded.sort_order, view_nodes.sort_order),
      position_x = COALESCE(excluded.position_x, view_nodes.position_x),
      position_y = COALESCE(excluded.position_y, view_nodes.position_y),
      edge_label = COALESCE(excluded.edge_label, view_nodes.edge_label)
  `);

  const tx = db.transaction(() => {
    for (const n of body.nodes) {
      upsert.run(viewId, n.node_id, n.parent_id ?? null, n.sort_order ?? null,
        n.position_x ?? null, n.position_y ?? null, n.edge_label ?? null);
    }
  });
  tx();

  return c.json({ ok: true });
});

// Delete a node from a view
views.delete('/:id/nodes/:nodeId', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const viewId = c.req.param('id');
  const nodeId = c.req.param('nodeId');

  if (!verifyViewOwnership(db, viewId, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  db.prepare('DELETE FROM view_nodes WHERE view_id = ? AND node_id = ?').run(viewId, nodeId);
  return c.json({ ok: true });
});

// Auto-generate a view grouped by a field
views.post('/auto-generate', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<AutoGenViewBody>();
  const db = getDb();

  if (!verifyProjectOwnership(db, body.project_id, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const id = uuid();
  const name = body.name || `By ${body.group_by}`;
  const allNodes = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(body.project_id) as any[];

  // Group nodes — compute virtual positions for each group
  const groups = new Map<string, any[]>();
  for (const node of allNodes) {
    const key = node[body.group_by] || 'none';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  db.prepare(
    'INSERT INTO views (id, project_id, name, description, layout_config) VALUES (?, ?, ?, ?, ?)'
  ).run(id, body.project_id, name, `Auto-generated by ${body.group_by}`,
    JSON.stringify({ group_by: body.group_by }));

  const insertNode = db.prepare(
    'INSERT INTO view_nodes (view_id, node_id, parent_id, sort_order, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    let groupIdx = 0;
    for (const [groupKey, nodes] of groups) {
      nodes.forEach((node, idx) => {
        insertNode.run(id, node.id, node.parent_id, idx,
          groupIdx * 400, idx * 100);
      });
      groupIdx++;
    }
  });
  tx();

  const view = db.prepare('SELECT * FROM views WHERE id = ?').get(id);
  return c.json(view, 201);
});

export default views;
