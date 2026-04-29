import { Hono } from 'hono';
import { getDb } from '../db.js';
import type { Node, Edge, Tag, ProjectWithNodes } from '@tasktree/shared';

type AuthVars = { Variables: { userId: string; username: string } };
const exportRoutes = new Hono<AuthVars>();

function verifyProjectOwnership(db: ReturnType<typeof getDb>, projectId: string, userId: string): boolean {
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  return !!project;
}

// Helper: Build tree for markdown export
interface TreeNode {
  node: Node;
  children: TreeNode[];
}

function buildTree(nodes: Node[], parentId: string | null = null): TreeNode[] {
  return nodes
    .filter(n => n.parent_id === parentId)
    .map(node => ({ node, children: buildTree(nodes, node.id) }));
}

function treeToMarkdown(tree: TreeNode[], depth: number = 2): string {
  const lines: string[] = [];
  for (const { node, children } of tree) {
    const indent = '#'.repeat(depth);
    const status = node.status === 'done' ? '[done]' :
                   node.status === 'active' ? '[active]' :
                   node.status === 'dropped' ? '[dropped]' : '[pending]';
    lines.push(`${indent} ${status} ${node.title}`);
    if (node.notes) lines.push(`> ${node.notes}`);
    if (children.length > 0) {
      lines.push(treeToMarkdown(children, depth + 1));
    }
  }
  return lines.join('\n');
}

// Export project (JSON or Markdown)
exportRoutes.get('/:id/export', (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');
  const format = c.req.query('format') || 'json';

  if (!verifyProjectOwnership(db, id, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as { name: string } | undefined;
  if (!project) return c.json({ error: 'Not found' }, 404);

  const nodes = db.prepare('SELECT * FROM nodes WHERE project_id = ?').all(id) as Node[];
  const edges = db.prepare('SELECT * FROM edges WHERE project_id = ?').all(id) as Edge[];
  const tags = db.prepare('SELECT * FROM tags WHERE project_id = ?').all(id) as Tag[];

  if (format === 'markdown') {
    const tree = buildTree(nodes);
    const markdown = `# ${project.name}\n\n${treeToMarkdown(tree)}`;
    return c.text(markdown, 200, { 'Content-Type': 'text/markdown; charset=utf-8' });
  }

  const projectWithNodes: ProjectWithNodes = { ...project as any, nodes, edges, tags, views: [] };
  return c.json(projectWithNodes);
});

// Import data
exportRoutes.post('/:id/import', async (c) => {
  const userId = c.get('userId');
  const db = getDb();
  const id = c.req.param('id');

  if (!verifyProjectOwnership(db, id, userId)) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const body = await c.req.json<{ nodes: Node[]; edges: Edge[]; tags: Tag[] }>();

  const tx = db.transaction(() => {
    // Upsert nodes
    const upsertNode = db.prepare(`
      INSERT INTO nodes (id, project_id, parent_id, title, notes, status, position_x, position_y, sort_order, edge_label, created_at, priority, due_date, assignee_id, progress, node_type, attachments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        parent_id = excluded.parent_id,
        title = excluded.title,
        notes = excluded.notes,
        status = excluded.status,
        position_x = excluded.position_x,
        position_y = excluded.position_y,
        sort_order = excluded.sort_order,
        edge_label = excluded.edge_label,
        priority = excluded.priority,
        due_date = excluded.due_date,
        assignee_id = excluded.assignee_id,
        progress = excluded.progress,
        node_type = excluded.node_type,
        attachments = excluded.attachments
    `);

    for (const node of body.nodes) {
      if (node.project_id !== id) continue; // Skip nodes from other projects
      upsertNode.run(node.id, node.project_id, node.parent_id, node.title, node.notes, node.status,
        node.position_x, node.position_y, node.sort_order, node.edge_label, node.created_at,
        node.priority, node.due_date, node.assignee_id, node.progress, node.node_type, node.attachments);
    }

    // Upsert edges
    const upsertEdge = db.prepare(`
      INSERT INTO edges (id, project_id, source_id, target_id, label, created_at, edge_type, style)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_id = excluded.source_id,
        target_id = excluded.target_id,
        label = excluded.label,
        edge_type = excluded.edge_type,
        style = excluded.style
    `);

    for (const edge of body.edges) {
      if (edge.project_id !== id) continue;
      upsertEdge.run(edge.id, edge.project_id, edge.source_id, edge.target_id, edge.label, edge.created_at, edge.edge_type, edge.style);
    }

    // Upsert tags (handle duplicate names)
    const upsertTag = db.prepare(`
      INSERT INTO tags (id, project_id, name, color, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(project_id, name) DO UPDATE SET
        color = excluded.color
    `);

    for (const tag of body.tags) {
      if (tag.project_id !== id) continue;
      upsertTag.run(tag.id, tag.project_id, tag.name, tag.color, tag.created_at);
    }
  });
  tx();

  return c.json({ ok: true, imported: { nodes: body.nodes.length, edges: body.edges.length, tags: body.tags.length } });
});

export default exportRoutes;
