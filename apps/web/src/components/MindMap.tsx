import { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type NodeChange,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TaskNode } from './TaskNode';
import { LabeledEdge } from './LabeledEdge';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';
import { getDescendantIds } from '../hooks/useTree';

const nodeTypes = { task: TaskNode };
const edgeTypes = { labeled: LabeledEdge };

export default function MindMap() {
  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);
  const multiSelectedIds = useProjectStore((s) => s.multiSelectedIds);
  const setMultiSelectedIds = useProjectStore((s) => s.setMultiSelectedIds);
  const focusNodeId = useProjectStore((s) => s.focusNodeId);
  const setFocusNodeId = useProjectStore((s) => s.setFocusNodeId);
  const reactFlow = useReactFlow();
  const prevNodeCount = useRef(0);

  const internalNodes = useRef<Node[]>([]);

  const flowNodes: Node[] = useMemo(() => {
    let visible = nodes;

    if (focusNodeId) {
      const descIds = getDescendantIds(nodes, focusNodeId);
      const allowed = new Set([focusNodeId, ...descIds]);
      visible = nodes.filter((n) => allowed.has(n.id));
    }

    const result = visible.map((n) => ({
      id: n.id,
      type: 'task' as const,
      position: { x: n.position_x, y: n.position_y },
      data: {
        title: n.title,
        status: n.status,
        hasNotes: n.notes.length > 0,
        isSelected: n.id === selectedNodeId || multiSelectedIds.includes(n.id),
      },
    }));

    internalNodes.current = result;
    return result;
  }, [nodes, focusNodeId, selectedNodeId]);

  // All tree edges use LabeledEdge — supports double-click to add label
  const flowEdges: Edge[] = useMemo(() => {
    return nodes
      .filter((n) => n.parent_id !== null)
      .map((n) => ({
        id: `e-${n.parent_id}-${n.id}`,
        source: n.parent_id!,
        target: n.id,
        type: 'labeled',
      }));
  }, [nodes]);

  useEffect(() => {
    if (nodes.length > 0 && prevNodeCount.current === 0) {
      setTimeout(() => reactFlow.fitView({ padding: 0.2 }), 100);
    }
    prevNodeCount.current = nodes.length;
  }, [nodes.length, reactFlow]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const filtered = changes.filter(
        (c) => c.type === 'dimensions' || c.type === 'position'
      );
      if (filtered.length === 0) return;

      const updated = applyNodeChanges(filtered, internalNodes.current);
      internalNodes.current = updated;
    },
    []
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      api.updatePosition(node.id, node.position.x, node.position.y);
      setNodes(
        nodes.map((n) =>
          n.id === node.id
            ? { ...n, position_x: node.position.x, position_y: node.position.y }
            : n
        )
      );
    },
    [nodes, setNodes]
  );

  const onNodeClick = useCallback(
    (evt: React.MouseEvent, node: Node) => {
      if (evt.ctrlKey || evt.metaKey) {
        // Ctrl/Cmd+Click → focus subtree
        setFocusNodeId(node.id);
      } else if (evt.shiftKey) {
        // Shift+Click → toggle multi-select
        setMultiSelectedIds(
          multiSelectedIds.includes(node.id)
            ? multiSelectedIds.filter((id) => id !== node.id)
            : [...multiSelectedIds, node.id]
        );
      } else {
        // Regular click → single select
        setSelectedNodeId(node.id);
      }
    },
    [setSelectedNodeId, setFocusNodeId, multiSelectedIds, setMultiSelectedIds]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setMultiSelectedIds([]);
  }, [setSelectedNodeId, setMultiSelectedIds]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#374151" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-700" />
      </ReactFlow>
    </div>
  );
}
