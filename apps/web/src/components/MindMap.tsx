import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
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

  const flowNodes: Node<TaskNodeData>[] = useMemo(() => {
    let visible = nodes;

    if (focusNodeId) {
      const descIds = getDescendantIds(nodes, focusNodeId);
      const allowed = new Set([focusNodeId, ...descIds]);
      visible = nodes.filter((n) => allowed.has(n.id));
    }

    return visible.map((n) => ({
      id: n.id,
      type: 'task',
      position: { x: n.position_x, y: n.position_y },
      data: {
        title: n.title,
        status: n.status,
        hasNotes: n.notes.length > 0,
        isSelected: n.id === selectedNodeId,
      },
    }));
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

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, flowNodes);
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.id) {
          api.updatePosition(change.id, change.position.x, change.position.y);
        }
      }
      const updatedNodes = nodes.map((n) => {
        const moved = updated.find((u) => u.id === n.id);
        if (moved && moved.position) {
          return { ...n, position_x: moved.position.x, position_y: moved.position.y };
        }
        return n;
      });
      setNodes(updatedNodes as typeof nodes);
    },
    [flowNodes, nodes, setNodes]
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
