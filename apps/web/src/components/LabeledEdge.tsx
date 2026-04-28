import { useState, useCallback, memo, useEffect, useRef } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';

const edgeTypeStyles: Record<string, { stroke: string; strokeDasharray: string; label: string }> = {
  child_of: { stroke: '#6b7280', strokeDasharray: '', label: '' },
  depends_on: { stroke: '#ef4444', strokeDasharray: '8 4', label: 'depends on' },
  blocks: { stroke: '#f97316', strokeDasharray: '6 3', label: 'blocks' },
  relates_to: { stroke: '#9ca3af', strokeDasharray: '3 3', label: 'relates to' },
};

function LabeledEdgeComponent({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  target,
  source,
  style,
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
  const customEdges = useProjectStore((s) => s.customEdges);
  const hiddenEdgeTypes = useProjectStore((s) => s.hiddenEdgeTypes);

  // Find edge_type from customEdges
  const customEdge = customEdges.find((e) => e.source_id === source && e.target_id === target);
  const edgeType = customEdge?.edge_type || 'child_of';
  const typeStyle = edgeTypeStyles[edgeType] || edgeTypeStyles.child_of;

  // Check if this edge type is hidden
  if (hiddenEdgeTypes.has(edgeType) && edgeType !== 'child_of') return null;

  // target is the child node ID — the edge_label is stored on the child
  const childId = target;
  const childNode = nodes.find((n) => n.id === childId);
  const currentLabel = childNode?.edge_label || '';

  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(currentLabel);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setEditLabel(currentLabel);
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
    if (e.key === 'Enter') { e.preventDefault(); saveLabel(); }
    if (e.key === 'Escape') { setIsEditing(false); setEditLabel(currentLabel); }
  }, [saveLabel, currentLabel]);

  const showLabel = currentLabel || isEditing || (edgeType !== 'child_of' && typeStyle.label);
  const baseOpacity = style?.opacity ?? 0.6;
  const displayOpacity = hovered ? 1 : baseOpacity;

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: typeStyle.stroke,
          strokeWidth: hovered ? 2.5 : 1.5,
          strokeDasharray: typeStyle.strokeDasharray,
          opacity: displayOpacity,
          transition: 'stroke-width 0.15s, opacity 0.15s',
        }}
      />
      {/* Invisible wider path for hover/click */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        style={{ cursor: 'pointer' }}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
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
                className={`px-2 py-0.5 rounded text-xs select-none transition-colors ${
                  edgeType !== 'child_of'
                    ? 'bg-gray-900/90 text-gray-300 border border-gray-600'
                    : hovered
                      ? 'bg-gray-800/90 text-gray-300 border border-gray-500'
                      : 'bg-gray-800/60 text-gray-400 border border-gray-700'
                } cursor-pointer`}
              >
                {currentLabel || typeStyle.label}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LabeledEdge = memo(LabeledEdgeComponent);
