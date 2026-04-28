import { create } from 'zustand';
import type { Project, Node } from '@mindmap/shared';

interface ProjectStore {
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  nodes: Node[];
  setNodes: (nodes: Node[]) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  focusNodeId: string | null;
  setFocusNodeId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  currentProject: null,
  setCurrentProject: (currentProject) => set({ currentProject }),
  nodes: [],
  setNodes: (nodes) => set({ nodes }),
  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  editingNodeId: null,
  setEditingNodeId: (editingNodeId) => set({ editingNodeId }),
  focusNodeId: null,
  setFocusNodeId: (focusNodeId) => set({ focusNodeId }),
}));
