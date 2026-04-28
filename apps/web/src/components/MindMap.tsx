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
import { TaskNode, type TaskNodeData } from './TaskNode';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';
import { getDescendantIds } from '../hooks/useTree';

const nodeTypes = { task: TaskNode };

export default function MindMap() {
  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);
  const focusNodeId = useProjectStore((s) => s.focusNodeId);
  const setFocusNodeId = useProjectStore((s) => s.setFocusNodeId);
  const reactFlow = useReactFlow();
  const prevNodeCount = useRef(0);

  // Track internal node state to avoid loop
  const internalNodes = useRef<Node<TaskNodeData>[]>([]);

  const flowNodes: Node<TaskNodeData>[] = useMemo(() => {
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
        isSelected: n.id === selectedNodeId,
      },
    }));

    internalNodes.current = result;
    return result;
  }, [nodes, focusNodeId, selectedNodeId]);

  const flowEdges: Edge[] = useMemo(() => {
    return nodes
      .filter((n) => n.parent_id !== null)
      .map((n) => ({
        id: `e-${n.parent_id}-${n.id}`,
        source: n.parent_id!,
        target: n.id,
        type: 'smoothstep',
        style: { stroke: '#4b5563', strokeWidth: 2 },
      }));
  }, [nodes]);

  // Re-fit view when nodes first load
  useEffect(() => {
    if (nodes.length > 0 && prevNodeCount.current === 0) {
      setTimeout(() => reactFlow.fitView({ padding: 0.2 }), 100);
    }
    prevNodeCount.current = nodes.length;
  }, [nodes.length, reactFlow]);

  const onNodesChange: OnNodesChange<TaskNodeData> = useCallback(
    (changes: NodeChange<TaskNodeData>[]) => {
      // Only apply dimension/position changes, ignore select changes (we handle that ourselves)
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
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setFocusNodeId(node.id);
    },
    [setFocusNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
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
