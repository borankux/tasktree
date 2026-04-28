import { useEffect } from 'react';
import { api } from '../lib/api';
import { useProjectStore } from '../store/projectStore';
import type { NodeStatus } from '@mindmap/shared';

export function useShortcuts() {
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);
  const setEditingNodeId = useProjectStore((s) => s.setEditingNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);
  const focusNodeId = useProjectStore((s) => s.focusNodeId);
  const setFocusNodeId = useProjectStore((s) => s.setFocusNodeId);
  const currentProject = useProjectStore((s) => s.currentProject);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter' && selectedNodeId && currentProject) {
        e.preventDefault();
        const newNode = await api.createNode({
          project_id: currentProject.id,
          parent_id: selectedNodeId,
          title: 'New task',
        });
        setNodes([...nodes, newNode]);
        setSelectedNodeId(newNode.id);
      }

      if (e.key === 'F2' && selectedNodeId) {
        e.preventDefault();
        setEditingNodeId(selectedNodeId);
      }

      if (e.key === 'Delete' && selectedNodeId) {
        e.preventDefault();
        await api.deleteNode(selectedNodeId);
        setNodes(nodes.filter((n) => n.id !== selectedNodeId));
        setSelectedNodeId(null);
      }

      const statusMap: Record<string, NodeStatus> = {
        '1': 'pending',
        '2': 'active',
        '3': 'done',
        '4': 'dropped',
      };
      if (statusMap[e.key] && selectedNodeId) {
        e.preventDefault();
        const status = statusMap[e.key];
        await api.updateNode(selectedNodeId, { status });
        setNodes(nodes.map((n) => (n.id === selectedNodeId ? { ...n, status } : n)));
      }

      if (e.key === 'Escape') {
        if (focusNodeId) {
          setFocusNodeId(null);
        } else {
          setSelectedNodeId(null);
          setEditingNodeId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, nodes, currentProject, focusNodeId, setNodes, setSelectedNodeId, setEditingNodeId, setFocusNodeId]);
}
