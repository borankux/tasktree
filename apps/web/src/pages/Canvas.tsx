import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';
import MindMap from '../components/MindMap';
import NodeEditor from '../components/NodeEditor';
import Toolbar from '../components/Toolbar';
import CommandPalette from '../components/CommandPalette';
import { useShortcuts } from '../hooks/useShortcuts';

function Breadcrumbs() {
  const focusNodeId = useProjectStore((s) => s.focusNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const setFocusNodeId = useProjectStore((s) => s.setFocusNodeId);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);

  if (!focusNodeId) return null;

  // Build path from root to focus node
  const path: string[] = [];
  let current = focusNodeId;
  while (current) {
    path.unshift(current);
    const node = nodes.find((n) => n.id === current);
    current = node?.parent_id ?? '';
  }

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-gray-800/90 border border-gray-700 rounded-lg px-3 py-1.5 shadow-lg">
      {path.map((id, i) => {
        const node = nodes.find((n) => n.id === id);
        if (!node) return null;
        const isLast = i === path.length - 1;
        return (
          <span key={id} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-600 text-xs">/</span>}
            <button
              onClick={() => {
                if (isLast) {
                  setFocusNodeId(null);
                } else {
                  setFocusNodeId(id);
                  setSelectedNodeId(id);
                }
              }}
              className={`text-xs ${isLast ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}
            >
              {node.title.length > 20 ? node.title.slice(0, 20) + '...' : node.title}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function ResizablePanel({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(288);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - ev.clientX;
      setWidth(Math.max(240, Math.min(480, startWidth.current + delta)));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  return (
    <div className="flex h-full">
      <div
        className="w-1 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors flex-shrink-0"
        onMouseDown={onMouseDown}
      />
      <div style={{ width }} className="flex-shrink-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function CanvasInner() {
  useShortcuts();
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-900 relative">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative">
          <Breadcrumbs />
          <MindMap />
        </div>
        <ResizablePanel>
          <NodeEditor />
        </ResizablePanel>
      </div>
      {showPalette && <CommandPalette onClose={() => setShowPalette(false)} />}
    </div>
  );
}

export default function Canvas() {
  const { id } = useParams<{ id: string }>();
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setNodes = useProjectStore((s) => s.setNodes);
  const setCustomEdges = useProjectStore((s) => s.setCustomEdges);
  const setTags = useProjectStore((s) => s.setTags);
  const setViews = useProjectStore((s) => s.setViews);

  useEffect(() => {
    if (!id) return;

    api.getProject(id).then((data) => {
      const { nodes: _, edges: __, tags: ___, views: ____, ...project } = data;
      setCurrentProject(project);
      setNodes(data.nodes);
      setCustomEdges(data.edges ?? []);
      setTags(data.tags ?? []);
      setViews(data.views ?? []);
    });

    return () => {
      setCurrentProject(null);
      setNodes([]);
      setCustomEdges([]);
      setTags([]);
      setViews([]);
    };
  }, [id, setCurrentProject, setNodes, setCustomEdges, setTags, setViews]);

  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
