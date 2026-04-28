import { Hono } from 'hono';
import { getDb } from '../db.js';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node } from '@mindmap/shared';

const layout = new Hono();

const elk = new ELK();

layout.post('/:id/layout', async (c) => {
  const projectId = c.req.param('id');
  const db = getDb();

  const nodes = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(projectId) as Node[];
  if (nodes.length === 0) return c.json([]);

  // Build ELK graph
  const elkNodes = nodes.map((n) => ({
    id: n.id,
    width: 200,
    height: 60,
  }));

  const elkEdges = nodes
    .filter((n) => n.parent_id !== null)
    .map((n) => ({
      id: `${n.parent_id}-${n.id}`,
      sources: [n.parent_id!],
      targets: [n.id],
    }));

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.layered.nodePlacement.strategy': 'SIMPLE',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const result = await elk.layout(elkGraph);

  // Update positions in DB
  const updateStmt = db.prepare('UPDATE nodes SET position_x = ?, position_y = ? WHERE id = ?');
  const updates = result.children.map((child) => ({
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
