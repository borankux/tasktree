import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { CreateSnapshotBody, SnapshotDiff } from '@tasktree/shared';

type AuthVars = { Variables: { userId: string; username: string } };
const snapshots = new Hono<AuthVars>();

function verifyProjectOwnership(db: ReturnType<typeof getDb>, projectId: string, userId: string): boolean {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return !!project;
}

function verifySnapshotOwnership(db: ReturnType<typeof getDb>, snapshotId: string, userId: string): boolean {
  const snapshot = db.prepare('SELECT project_id FROM snapshots WHERE id = ?').get(snapshotId) as { project_id: string } | undefined;
  if (!snapshot) return false;
  return verifyProjectOwnership(db, snapshot.project_id, userId);
}

interface SnapshotData {
  nodes: unknown[];
  edges: unknown[];
  tags: unknown[];
  node_tags: unknown[];
}

// Create snapshot
snapshots.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<CreateSnapshotBody>();
  const id = uuid();
  const db = getDb();

  if (!verifyProjectOwnership(db, body.project_id, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Fetch all project data
  const nodes = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(body.project_id);
  const edges = db.prepare('SELECT * FROM edges WHERE project_id = ?').all(body.project_id);
  const tags = db.prepare('SELECT * FROM tags WHERE project_id = ?').all(body.project_id);
  const nodeTags = db.prepare('SELECT nt.* FROM node_tags nt JOIN nodes n ON nt.node_id = n.id WHERE n.project_id = ?').all(body.project_id);

  const data: SnapshotData = { nodes, edges, tags, node_tags: nodeTags };

  db.prepare(
    'INSERT INTO snapshots (id, project_id, name, description, data, node_count, edge_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, body.project_id, body.name, body.description || '', JSON.stringify(data), nodes.length, edges.length);

  const snapshot = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id);
  return c.json(snapshot, 201);
});

// List snapshots for a project (exclude data blob)
snapshots.get('/project/:projectId', (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const db = getDb();

  if (!verifyProjectOwnership(db, projectId, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const result = db.prepare('SELECT id, project_id, name, description, node_count, edge_count, created_at FROM snapshots WHERE project_id = ?').all(projectId);
  return c.json(result);
});

// Get single snapshot with full data
snapshots.get('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');

  if (!verifySnapshotOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const snapshot = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id);
  if (!snapshot) return c.json({ error: 'Not found' }, 404);
  return c.json(snapshot);
});

// Restore from snapshot
snapshots.post('/:id/restore', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');

  if (!verifySnapshotOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const snapshot = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as { project_id: string; data: string } | undefined;
  if (!snapshot) return c.json({ error: 'Not found' }, 404);

  const parsedData: SnapshotData = JSON.parse(snapshot.data);

  const tx = db.transaction(() => {
    // Delete existing data
    db.prepare('DELETE FROM node_tags WHERE node_id IN (SELECT id FROM nodes WHERE project_id = ?)').run(snapshot.project_id);
    db.prepare('DELETE FROM edges WHERE project_id = ?').run(snapshot.project_id);
    db.prepare('DELETE FROM tags WHERE project_id = ?').run(snapshot.project_id);
    db.prepare('DELETE FROM nodes WHERE project_id = ?').run(snapshot.project_id);

    // Re-insert from snapshot
    const insertNode = db.prepare('INSERT INTO nodes (id, project_id, parent_id, title, notes, status, position_x, position_y, sort_order, edge_label, created_at, priority, due_date, assignee_id, progress, node_type, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const node of parsedData.nodes as any[]) {
      insertNode.run(node.id, node.project_id, node.parent_id, node.title, node.notes, node.status, node.position_x, node.position_y, node.sort_order, node.edge_label, node.created_at, node.priority, node.due_date, node.assignee_id, node.progress, node.node_type, node.attachments);
    }

    const insertEdge = db.prepare('INSERT INTO edges (id, project_id, source_id, target_id, label, created_at, edge_type, style) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const edge of parsedData.edges as any[]) {
      insertEdge.run(edge.id, edge.project_id, edge.source_id, edge.target_id, edge.label, edge.created_at, edge.edge_type, edge.style);
    }

    const insertTag = db.prepare('INSERT INTO tags (id, project_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)');
    for (const tag of parsedData.tags as any[]) {
      insertTag.run(tag.id, tag.project_id, tag.name, tag.color, tag.created_at);
    }

    const insertNodeTag = db.prepare('INSERT INTO node_tags (node_id, tag_id) VALUES (?, ?)');
    for (const nt of parsedData.node_tags as any[]) {
      insertNodeTag.run(nt.node_id, nt.tag_id);
    }
  });
  tx();

  return c.json({ ok: true, restored_count: { nodes: parsedData.nodes.length, edges: parsedData.edges.length, tags: parsedData.tags.length } });
});

// Delete snapshot
snapshots.delete('/:id', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');

  if (!verifySnapshotOwnership(db, id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  db.prepare('DELETE FROM snapshots WHERE id = ?').run(id);
  return c.json({ ok: true });
});

// Diff two snapshots
snapshots.get('/:id/diff', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const sourceId = c.req.param('id');
  const targetId = c.req.query('target');

  if (!targetId) {
    return c.json({ error: 'target query param required' }, 400);
  }

  const source = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(sourceId) as { project_id: string; data: string } | undefined;
  const target = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(targetId) as { project_id: string; data: string } | undefined;

  if (!source || !target) {
    return c.json({ error: 'Snapshot not found' }, 404);
  }

  if (source.project_id !== target.project_id) {
    return c.json({ error: 'Snapshots must belong to the same project' }, 400);
  }

  if (!verifyProjectOwnership(db, source.project_id, userId)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const sourceData: SnapshotData = JSON.parse(source.data);
  const targetData: SnapshotData = JSON.parse(target.data);

  const sourceNodes = new Map((sourceData.nodes as any[]).map(n => [n.id, n]));
  const targetNodes = new Map((targetData.nodes as any[]).map(n => [n.id, n]));

  const added: any[] = [];
  const removed: any[] = [];
  const modified: { before: any; after: any }[] = [];

  for (const [id, node] of targetNodes) {
    if (!sourceNodes.has(id)) {
      added.push(node);
    } else {
      const sourceNode = sourceNodes.get(id);
      if (sourceNode && (
        sourceNode.title !== node.title ||
        sourceNode.status !== node.status ||
        sourceNode.priority !== node.priority ||
        sourceNode.progress !== node.progress ||
        sourceNode.node_type !== node.node_type
      )) {
        modified.push({ before: sourceNode, after: node });
      }
    }
  }

  for (const [id, node] of sourceNodes) {
    if (!targetNodes.has(id)) {
      removed.push(node);
    }
  }

  const diff: SnapshotDiff = { added, removed, modified };
  return c.json(diff);
});

export default snapshots;
