import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeStatus, NodePriority, NodeType } from '@tasktree/shared';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';

const statusColors: Record<NodeStatus, string> = {
  pending: 'border-gray-500 bg-gray-800',
  active: 'border-yellow-500 bg-gray-800 ring-1 ring-yellow-500/30',
  done: 'border-green-500 bg-green-900/30',
  dropped: 'border-red-500 bg-red-900/30 opacity-60',
};

const statusDot: Record<NodeStatus, string> = {
  pending: 'bg-gray-500',
  active: 'bg-yellow-500',
  done: 'bg-green-500',
  dropped: 'bg-red-500',
};

const priorityBadge: Record<NodePriority, { bg: string; label: string }> = {
  p0: { bg: 'bg-red-500', label: 'P0' },
  p1: { bg: 'bg-orange-500', label: 'P1' },
  p2: { bg: 'bg-gray-600', label: 'P2' },
  p3: { bg: 'bg-gray-700', label: 'P3' },
};

const typeIcons: Record<NodeType, string> = {
  task: '',
  milestone: '\u25C6',
  group: '\u229E',
  decision: '\u25C8',
  note: '\u270E',
};

export interface TaskNodeData {
  title: string;
  status: NodeStatus;
  hasNotes: boolean;
  isSelected: boolean;
  priority: NodePriority;
  node_type: NodeType;
  progress: number;
  due_date: string | null;
  filteredOut: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  isSearchMatch: boolean;
  isSearchDimmed: boolean;
}

export type TaskNodeProps = {
  data: TaskNodeData;
  id: string;
};

function TaskNodeComponent({ data, id }: TaskNodeProps) {
  const editingNodeId = useProjectStore((s) => s.editingNodeId);
  const setEditingNodeId = useProjectStore((s) => s.setEditingNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);
  const toggleCollapsed = useProjectStore((s) => s.toggleCollapsed);
  const isEditing = editingNodeId === id;

  const [editTitle, setEditTitle] = useState(data.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setEditTitle(data.title);
  }, [data.title, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const saveTitle = useCallback(async () => {
    const trimmed = editTitle.trim();
    if (!trimmed) { setEditTitle(data.title); return; }
    if (trimmed === data.title) return;
    await api.updateNode(id, { title: trimmed });
    setNodes(nodes.map((n) => (n.id === id ? { ...n, title: trimmed } : n)));
  }, [editTitle, data.title, id, nodes, setNodes]);

  const handleBlur = useCallback(() => { saveTitle(); setEditingNodeId(null); }, [saveTitle, setEditingNodeId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setEditTitle(data.title); setEditingNodeId(null); return; }
    if (e.key === 'Enter') { e.preventDefault(); saveTitle().then(() => setEditingNodeId(null)); }
  }, [data.title, setEditingNodeId, saveTitle]);

  const handleCollapseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCollapsed(id);
  }, [id, toggleCollapsed]);

  const showPriority = data.priority !== 'p2';
  const showProgress = data.progress > 0;
  const showDueDate = data.due_date;
  const showTypeIcon = data.node_type !== 'task';
  const p = priorityBadge[data.priority];
  const isOverdue = showDueDate && new Date(data.due_date!) < new Date() && data.status !== 'done';

  // Search highlight: gold ring pulse for matches, dim for non-matches
  const searchClass = data.isSearchMatch
    ? 'ring-2 ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
    : data.isSearchDimmed
      ? 'opacity-30'
      : '';

  return (
    <div
      className={`px-3 py-2 rounded-lg border-2 max-w-[280px] transition-all duration-200 ${statusColors[data.status]} ${data.isSelected ? 'ring-2 ring-blue-400' : ''} ${data.filteredOut ? 'opacity-20' : ''} ${searchClass}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-600 !w-2 !h-2" isConnectable={false} />

      {/* Top row: badges */}
      {(showPriority || showTypeIcon || showDueDate) && (
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          {showPriority && (
            <span className={`${p.bg} text-white text-[10px] font-bold px-1.5 py-0 rounded`}>{p.label}</span>
          )}
          {showTypeIcon && (
            <span className="text-gray-400 text-xs">{typeIcons[data.node_type]}</span>
          )}
          {showDueDate && (
            <span className={`text-[10px] px-1.5 py-0 rounded ${isOverdue ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-400'}`}>
              {data.due_date!.slice(5)}
            </span>
          )}
        </div>
      )}

      {/* Title row */}
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot[data.status]}`} />
        {isEditing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="text-sm font-medium text-white bg-transparent outline-none border-b border-blue-400 min-w-0 flex-1"
          />
        ) : (
          <span className="text-sm font-medium text-white truncate">{data.title}</span>
        )}
        {data.hasNotes && !isEditing && <span className="text-gray-500 text-xs ml-1">&#9998;</span>}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${data.progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${data.progress}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 w-8 text-right">{data.progress}%</span>
        </div>
      )}

      {/* Collapse toggle arrow */}
      {data.hasChildren && (
        <button
          onClick={handleCollapseClick}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-gray-400 hover:bg-gray-600 hover:text-white transition-colors z-10"
          title={data.isCollapsed ? 'Expand children' : 'Collapse children'}
        >
          <span className={`text-[10px] transition-transform duration-200 ${data.isCollapsed ? '' : 'rotate-180'}`}>&#9660;</span>
        </button>
      )}

      <Handle type="source" position={Position.Right} className="!bg-gray-600 !w-2 !h-2" isConnectable={false} />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
