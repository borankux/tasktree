import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { CreateTagBody, UpdateTagBody, NodeTagBody } from '@tasktree/shared';

type AuthVars = { Variables: { userId: string; username: string } };
const tags = new Hono<AuthVars>();

function verifyProjectOwnership(db: ReturnType<typeof getDb>, projectId: string, userId: string): boolean {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return !!project;
}

function verifyTagOwnership(db: ReturnType<typeof getDb>, tagId: string, userId: string): boolean {
  const tag = db.prepare('SELECT project_id FROM tags WHERE id = ?').get(tagId) as { project_id: string } | undefined;
  if (!tag) return false;
  return verifyProjectOwnership(db, tag.project_id, userId);
}

// List tags for a project
tags.get('/project/:projectId', (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const db = getDb();

  if (!verifyProjectOwnership(db, projectId, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const result = db.prepare('SELECT * FROM tags WHERE project_id = ?').all(projectId);
  return c.json(result);
});

// Create tag
tags.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<CreateTagBody>();
  const id = uuid();
  const db = getDb();

  if (!verifyProjectOwnership(db, body.project_id, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  try {
    db.prepare(
      'INSERT INTO tags (id, project_id, name, color) VALUES (?, ?, ?, ?)'
    ).run(id, body.project_id, body.name, body.color || '#6B7280');
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return c.json({ error: 'Tag name already exists in this project' }, 409);
    }
    throw err;
  }

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  return c.json(tag, 201);
});

// Update tag
tags.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<UpdateTagBody>();
  const db = getDb();
  const id = c.req.param('id');

  if (!verifyTagOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); values.push(body.name); }
  if (body.color !== undefined) { sets.push('color = ?'); values.push(body.color); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(id);
  try {
    db.prepare(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return c.json({ error: 'Tag name already exists in this project' }, 409);
    }
    throw err;
  }

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  return c.json(tag);
});

// Delete tag
tags.delete('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');

  if (!verifyTagOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  return c.json({ ok: true });
});

// Tag a node
tags.post('/node/:nodeId', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<NodeTagBody>();
  const db = getDb();
  const nodeId = c.req.param('nodeId');

  // Verify node ownership via project
  const node = db.prepare('SELECT project_id FROM nodes WHERE id = ?').get(nodeId) as { project_id: string } | undefined;
  if (!node || !verifyProjectOwnership(db, node.project_id, userId)) {
    return c.json({ error: 'Node not found' }, 404);
  }

  // Verify tag belongs to same project
  const tag = db.prepare('SELECT project_id FROM tags WHERE id = ?').get(body.tag_id) as { project_id: string } | undefined;
  if (!tag || tag.project_id !== node.project_id) {
    return c.json({ error: 'Tag not found or not in same project' }, 404);
  }

  try {
    db.prepare('INSERT INTO node_tags (node_id, tag_id) VALUES (?, ?)').run(nodeId, body.tag_id);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return c.json({ error: 'Node already has this tag' }, 409);
    }
    throw err;
  }

  return c.json({ ok: true }, 201);
});

// Untag a node
tags.delete('/node/:nodeId/:tagId', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const nodeId = c.req.param('nodeId');
  const tagId = c.req.param('tagId');

  const node = db.prepare('SELECT project_id FROM nodes WHERE id = ?').get(nodeId) as { project_id: string } | undefined;
  if (!node || !verifyProjectOwnership(db, node.project_id, userId)) {
    return c.json({ error: 'Node not found' }, 404);
  }

  db.prepare('DELETE FROM node_tags WHERE node_id = ? AND tag_id = ?').run(nodeId, tagId);
  return c.json({ ok: true });
});

export default tags;
