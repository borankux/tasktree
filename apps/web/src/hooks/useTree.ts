import type { Node } from '@mindmap/shared';

export interface TreeNode extends Node {
  children: TreeNode[];
}

/** Convert flat node list to tree structure */
export function buildTree(nodes: Node[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] });
  }

  for (const node of nodes) {
    const treeNode = map.get(node.id)!;
    if (node.parent_id === null) {
      roots.push(treeNode);
    } else {
      const parent = map.get(node.parent_id);
      if (parent) {
        parent.children.push(treeNode);
      }
    }
  }

  return roots;
}

/** Get all descendant node IDs of a given node */
export function getDescendantIds(nodes: Node[], nodeId: string): string[] {
  const ids: string[] = [];
  const children = nodes.filter((n) => n.parent_id === nodeId);
  for (const child of children) {
    ids.push(child.id);
    ids.push(...getDescendantIds(nodes, child.id));
  }
  return ids;
}
