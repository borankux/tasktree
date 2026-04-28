import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeStatus } from '@tasktree/shared';
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

export interface TaskNodeData {
  title: string;
  status: NodeStatus;
  hasNotes: boolean;
  isSelected: boolean;
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
  const isEditing = editingNodeId === id;

  const [editTitle, setEditTitle] = useState(data.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync title from data when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditTitle(data.title);
    }
  }, [data.title, isEditing]);

  // Auto-focus and select when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const saveTitle = useCallback(async () => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditTitle(data.title);
      return;
    }
    if (trimmed === data.title) return;
    await api.updateNode(id, { title: trimmed });
    setNodes(nodes.map((n) => (n.id === id ? { ...n, title: trimmed } : n)));
  }, [editTitle, data.title, id, nodes, setNodes]);

  const handleBlur = useCallback(() => {
    saveTitle();
    setEditingNodeId(null);
  }, [saveTitle, setEditingNodeId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setEditTitle(data.title);
      setEditingNodeId(null);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // Save and exit edit mode — do NOT create sibling
      saveTitle().then(() => {
        setEditingNodeId(null);
      });
    }
  }, [data.title, setEditingNodeId, saveTitle]);

  return (
    <div
      className={`px-3 py-2 rounded-lg border-2 max-w-[260px] ${statusColors[data.status]} ${data.isSelected ? 'ring-2 ring-blue-400' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-600 !w-2 !h-2" isConnectable={false} />

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

      <Handle type="source" position={Position.Right} className="!bg-gray-600 !w-2 !h-2" isConnectable={false} />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
