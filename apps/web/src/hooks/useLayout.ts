import { useCallback } from 'react';
import { api } from '../lib/api';
import { useProjectStore } from '../store/projectStore';

export function useLayout() {
  const setNodes = useProjectStore((s) => s.setNodes);
  const currentProject = useProjectStore((s) => s.currentProject);
  const layoutDirection = useProjectStore((s) => s.layoutDirection);

  const autoLayout = useCallback(async () => {
    if (!currentProject) return;
    const nodes = await api.layoutProject(currentProject.id, layoutDirection);
    setNodes(nodes);
  }, [currentProject, setNodes, layoutDirection]);

  return { autoLayout };
}
