import { useState, useCallback, memo, useEffect, useRef } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';

function LabeledEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  target,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);

  // target is the child node ID — the edge_label is stored on the child
  const childId = target;
  const childNode = nodes.find((n) => n.id === childId);
  const currentLabel = childNode?.edge_label || '';

  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(currentLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditLabel(currentLabel);
    }
  }, [currentLabel, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const saveLabel = useCallback(async () => {
    setIsEditing(false);
    const trimmed = editLabel.trim();
    if (trimmed === currentLabel) return;
    await api.updateNode(childId, { edge_label: trimmed });
    setNodes(nodes.map((n) => (n.id === childId ? { ...n, edge_label: trimmed } : n)));
  }, [editLabel, currentLabel, childId, nodes, setNodes]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveLabel();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditLabel(currentLabel);
    }
  }, [saveLabel, currentLabel]);

  const showLabel = currentLabel || isEditing;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{ stroke: '#6b7280', strokeWidth: 1.5, opacity: 0.6 }}
      />
      {/* Invisible wider path for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: 'pointer' }}
        onDoubleClick={handleDoubleClick}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {isEditing ? (
              <input
                ref={inputRef}
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={saveLabel}
                onKeyDown={handleKeyDown}
                className="bg-gray-800 text-white text-xs px-2 py-1 rounded border border-blue-500 outline-none min-w-[60px] text-center"
              />
            ) : (
              <div
                onDoubleClick={handleDoubleClick}
                className="bg-gray-800/90 text-gray-300 text-xs px-2 py-0.5 rounded border border-gray-600 cursor-pointer hover:border-gray-400 select-none"
              >
                {currentLabel}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LabeledEdge = memo(LabeledEdgeComponent);
