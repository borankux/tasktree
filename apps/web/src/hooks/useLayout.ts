import { useCallback } from 'react';
import { api } from '../lib/api';
import { useProjectStore } from '../store/projectStore';

export function useLayout() {
  const setNodes = useProjectStore((s) => s.setNodes);
  const currentProject = useProjectStore((s) => s.currentProject);

  const autoLayout = useCallback(async () => {
    if (!currentProject) return;
    const nodes = await api.layoutProject(currentProject.id);
    setNodes(nodes);
  }, [currentProject, setNodes]);

  return { autoLayout };
}
