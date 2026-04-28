import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeStatus } from '@mindmap/shared';

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

function TaskNodeComponent({ data }: TaskNodeProps) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 min-w-[160px] max-w-[280px] ${statusColors[data.status]} ${data.isSelected ? 'ring-2 ring-blue-400' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-600 !w-2 !h-2" />

      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot[data.status]}`} />
        <span className="text-sm font-medium text-white truncate">{data.title}</span>
        {data.hasNotes && <span className="text-gray-500 text-xs ml-1">&#9998;</span>}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-gray-600 !w-2 !h-2" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
