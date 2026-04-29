import { Hono } from 'hono';
import { getDb } from '../db.js';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node } from '@tasktree/shared';

type AuthVars = { Variables: { userId: string; username: string } };
const layout = new Hono<AuthVars>();

const elk = new ELK();

layout.post('/:id/layout', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const db = getDb();

  // Verify project ownership
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  if (!project) return c.json({ error: 'Not found' }, 404);

  const nodes = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(projectId) as Node[];
  if (nodes.length === 0) return c.json([]);

  // Node size tuned for Chinese text readability
  const elkNodes = nodes.map((n) => ({
    id: n.id,
    width: 220,
    height: 48,
  }));

  const elkEdges = nodes
    .filter((n) => n.parent_id !== null)
    .map((n) => ({
      id: `${n.parent_id}-${n.id}`,
      sources: [n.parent_id!],
      targets: [n.id],
    }));

  // Left-to-right tree layout
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '24',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const result = await elk.layout(elkGraph);

  // Center the layout around (0, 0)
  const children = result.children ?? [];
  if (children.length > 0) {
    const xs = children.map((c) => (c.x ?? 0));
    const ys = children.map((c) => (c.y ?? 0));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    for (const child of children) {
      if (child.x !== undefined) child.x -= cx;
      if (child.y !== undefined) child.y -= cy;
    }
  }

  // Update positions in DB
  const updateStmt = db.prepare('UPDATE nodes SET position_x = ?, position_y = ? WHERE id = ?');
  const updates = children.map((child) => ({
    id: child.id,
    x: child.x ?? 0,
    y: child.y ?? 0,
  }));

  db.transaction(() => {
    for (const u of updates) {
      updateStmt.run(u.x, u.y, u.id);
    }
  })();

  // Return all nodes with updated positions
  const updatedNodes = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(projectId);
  return c.json(updatedNodes);
});

export default layout;
