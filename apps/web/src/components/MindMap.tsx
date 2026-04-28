import { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
  const filterPriority = useProjectStore((s) => s.filterPriority);
  const filterStatus = useProjectStore((s) => s.filterStatus);
  const filterType = useProjectStore((s) => s.filterType);
  const filterTagIds = useProjectStore((s) => s.filterTagIds);
  const collapsedNodeIds = useProjectStore((s) => s.collapsedNodeIds);
  const searchQuery = useProjectStore((s) => s.searchQuery);
  const reactFlow = useReactFlow();
  const prevNodeCount = useRef(0);

  const internalNodes = useRef<Node[]>([]);

  const hasActiveFilters = filterPriority.length > 0 || filterStatus.length > 0 || filterType.length > 0 || filterTagIds.length > 0;

  // Build set of collapsed descendants to exclude
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const cid of collapsedNodeIds) {
      const desc = getDescendantIds(nodes, cid);
      desc.forEach((d) => hidden.add(d));
    }
    return hidden;
  }, [nodes, collapsedNodeIds]);

  // Search match set
  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const matches = new Set<string>();
    for (const n of nodes) {
      if (n.title.toLowerCase().includes(q) || n.notes.toLowerCase().includes(q)) {
        matches.add(n.id);
      }
    }
    return matches;
  }, [nodes, searchQuery]);

  const flowNodes: Node[] = useMemo(() => {
    let visible = nodes;

    if (focusNodeId) {
      const descIds = getDescendantIds(nodes, focusNodeId);
      const allowed = new Set([focusNodeId, ...descIds]);
      visible = nodes.filter((n) => allowed.has(n.id));
    }

    const result = visible
      .filter((n) => !hiddenIds.has(n.id))
      .map((n) => {
        let filteredOut = false;
        if (hasActiveFilters) {
          if (filterPriority.length > 0 && !filterPriority.includes(n.priority)) filteredOut = true;
          if (filterStatus.length > 0 && !filterStatus.includes(n.status)) filteredOut = true;
          if (filterType.length > 0 && !filterType.includes(n.node_type)) filteredOut = true;
        }

        const hasChildren = nodes.some((c) => c.parent_id === n.id);
        const isCollapsed = collapsedNodeIds.has(n.id);
        const isSearchMatch = searchMatchIds.has(n.id);
        const isSearchDimmed = searchQuery.trim() && !isSearchMatch;

        return {
          id: n.id,
          type: 'task' as const,
          position: { x: n.position_x, y: n.position_y },
          data: {
            title: n.title,
            status: n.status,
            hasNotes: n.notes.length > 0,
            isSelected: n.id === selectedNodeId || multiSelectedIds.includes(n.id),
            priority: n.priority,
            node_type: n.node_type,
            progress: n.progress,
            due_date: n.due_date,
            filteredOut,
            hasChildren,
            isCollapsed,
            isSearchMatch,
            isSearchDimmed,
          },
        };
      });

    internalNodes.current = result;
    return result;
  }, [nodes, focusNodeId, selectedNodeId, hasActiveFilters, filterPriority, filterStatus, filterType, filterTagIds, hiddenIds, collapsedNodeIds, searchMatchIds, searchQuery]);

  // All tree edges use LabeledEdge
  const flowEdges: Edge[] = useMemo(() => {
    return nodes
      .filter((n) => n.parent_id !== null && !hiddenIds.has(n.id))
      .map((n) => {
        const sourceFiltered = hasActiveFilters && (
          (filterPriority.length > 0 && !filterPriority.includes(nodes.find(p => p.id === n.parent_id)?.priority ?? '')) ||
          (filterStatus.length > 0 && !filterStatus.includes(nodes.find(p => p.id === n.parent_id)?.status ?? '')) ||
          (filterType.length > 0 && !filterType.includes(nodes.find(p => p.id === n.parent_id)?.node_type ?? ''))
        );
        const targetFiltered = hasActiveFilters && (
          (filterPriority.length > 0 && !filterPriority.includes(n.priority)) ||
          (filterStatus.length > 0 && !filterStatus.includes(n.status)) ||
          (filterType.length > 0 && !filterType.includes(n.node_type))
        );
        return {
          id: `e-${n.parent_id}-${n.id}`,
          source: n.parent_id!,
          target: n.id,
          type: 'labeled',
          style: (sourceFiltered || targetFiltered) ? { opacity: 0.15 } : undefined,
        };
      });
  }, [nodes, hasActiveFilters, filterPriority, filterStatus, filterType, hiddenIds]);

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
        setFocusNodeId(node.id);
      } else if (evt.shiftKey) {
        setMultiSelectedIds(
          multiSelectedIds.includes(node.id)
            ? multiSelectedIds.filter((id) => id !== node.id)
            : [...multiSelectedIds, node.id]
        );
      } else {
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
        <MiniMap
          nodeColor={(n) => {
            if (n.data?.isSearchMatch) return '#fbbf24';
            if (n.data?.isSelected) return '#60a5fa';
            return '#4b5563';
          }}
          className="!bg-gray-800 !border-gray-700"
          maskColor="rgba(0,0,0,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
