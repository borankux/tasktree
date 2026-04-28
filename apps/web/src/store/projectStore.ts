import { create } from 'zustand';
import type { Project, Node, Edge } from '@tasktree/shared';

interface ProjectStore {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  nodes: Node[];
  setNodes: (nodes: Node[]) => void;
  customEdges: Edge[];
  setCustomEdges: (edges: Edge[]) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;
  // Multi-select
  multiSelectedIds: string[];
  setMultiSelectedIds: (ids: string[]) => void;
  // Clipboard
  clipboardIds: string[];
  clipboardMode: 'cut' | null;
  setClipboard: (ids: string[], mode: 'cut') => void;
  clearClipboard: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  currentProject: null,
  setCurrentProject: (currentProject) => set({ currentProject }),
  nodes: [],
  setNodes: (nodes) => set({ nodes }),
  customEdges: [],
  setCustomEdges: (customEdges) => set({ customEdges }),
  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId, multiSelectedIds: [] }),
  editingNodeId: null,
  setEditingNodeId: (editingNodeId) => set({ editingNodeId }),
  focusNodeId: null,
  setFocusNodeId: (focusNodeId) => set({ focusNodeId }),
  multiSelectedIds: [],
  setMultiSelectedIds: (multiSelectedIds) => set({ multiSelectedIds }),
  clipboardIds: [],
  clipboardMode: null,
  setClipboard: (clipboardIds, clipboardMode) => set({ clipboardIds, clipboardMode }),
  clearClipboard: () => set({ clipboardIds: [], clipboardMode: null }),
}));
