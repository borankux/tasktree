import { useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useProjectStore } from '../store/projectStore';
import type { NodeStatus } from '@tasktree/shared';

async function refreshNodes(currentProject: { id: string } | null, setNodes: (n: any[]) => void) {
  if (!currentProject) return;
  const data = await api.getProject(currentProject.id);
  setNodes(data.nodes);
}

export function useShortcuts() {
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);
  const editingNodeId = useProjectStore((s) => s.editingNodeId);
  const setEditingNodeId = useProjectStore((s) => s.setEditingNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);
  const focusNodeId = useProjectStore((s) => s.focusNodeId);
  const setFocusNodeId = useProjectStore((s) => s.setFocusNodeId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const multiSelectedIds = useProjectStore((s) => s.multiSelectedIds);
  const setMultiSelectedIds = useProjectStore((s) => s.setMultiSelectedIds);
  const setClipboard = useProjectStore((s) => s.setClipboard);
  const clearClipboard = useProjectStore((s) => s.clearClipboard);
  const clipboardIds = useProjectStore((s) => s.clipboardIds);

  const isComposing = useRef(false);

  useEffect(() => {
    const onCompositionStart = () => { isComposing.current = true; };
    const onCompositionEnd = () => { isComposing.current = false; };

    window.addEventListener('compositionstart', onCompositionStart);
    window.addEventListener('compositionend', onCompositionEnd);
    return () => {
      window.removeEventListener('compositionstart', onCompositionStart);
      window.removeEventListener('compositionend', onCompositionEnd);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (isComposing.current) return;

      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (editingNodeId) {
          setEditingNodeId(null);
        } else if (focusNodeId) {
          setFocusNodeId(null);
        } else {
          setSelectedNodeId(null);
          setMultiSelectedIds([]);
        }
        return;
      }

      if (inInput) return;

      const cmd = e.ctrlKey || e.metaKey;

      // Cmd+X → cut (single or multi-selected)
      if (e.key === 'x' && cmd) {
        const ids = multiSelectedIds.length > 0 ? multiSelectedIds : (selectedNodeId ? [selectedNodeId] : []);
        if (ids.length === 0) return;
        e.preventDefault();
        // Don't cut root nodes
        const cuttable = ids.filter((id) => {
          const n = nodes.find((node) => node.id === id);
          return n && n.parent_id !== null;
        });
        if (cuttable.length > 0) {
          setClipboard(cuttable, 'cut');
          setMultiSelectedIds([]);
        }
        return;
      }

      // Cmd+V → paste (move clipboard nodes under selected node)
      if (e.key === 'v' && cmd && clipboardIds.length > 0 && selectedNodeId && currentProject) {
        e.preventDefault();
        // Don't paste into self or descendants
        const targetId = selectedNodeId;
        for (const id of clipboardIds) {
          if (id === targetId) continue;
          // Check target is not a descendant of the node being moved
          const isDescendant = (parentId: string, checkId: string): boolean => {
            const children = nodes.filter((n) => n.parent_id === parentId);
            for (const child of children) {
              if (child.id === checkId || isDescendant(child.id, checkId)) return true;
            }
            return false;
          };
          if (isDescendant(id, targetId)) continue;

          await api.updateNode(id, { parent_id: targetId });
        }
        await refreshNodes(currentProject, setNodes);
        clearClipboard();
        return;
      }

      // Tab → create child node
      if (e.key === 'Tab' && selectedNodeId && currentProject) {
        e.preventDefault();
        const newNode = await api.createNode({
          project_id: currentProject.id,
          parent_id: selectedNodeId,
          title: 'New task',
        });
        await refreshNodes(currentProject, setNodes);
        setSelectedNodeId(newNode.id);
        setEditingNodeId(newNode.id);
        return;
      }

      // Enter → create sibling node
      if (e.key === 'Enter' && selectedNodeId && currentProject) {
        e.preventDefault();
        const currentNode = nodes.find((n) => n.id === selectedNodeId);
        if (!currentNode || currentNode.parent_id === null) return;
        const newNode = await api.createNode({
          project_id: currentProject.id,
          parent_id: currentNode.parent_id,
          title: 'New task',
        });
        await refreshNodes(currentProject, setNodes);
        setSelectedNodeId(newNode.id);
        setEditingNodeId(newNode.id);
        return;
      }

      // Ctrl+L → auto-layout
      if (e.key === 'l' && cmd && currentProject) {
        e.preventDefault();
        const updated = await api.layoutProject(currentProject.id);
        setNodes(updated);
        return;
      }

      // Delete / Backspace → batch delete (multi or single)
      if ((e.key === 'Delete' || e.key === 'Backspace') && !cmd) {
        const ids = multiSelectedIds.length > 0 ? multiSelectedIds : (selectedNodeId ? [selectedNodeId] : []);
        if (ids.length === 0) return;
        e.preventDefault();
        // Filter out root nodes
        const deletable = ids.filter((id) => {
          const n = nodes.find((node) => node.id === id);
          return n && n.parent_id !== null;
        });
        for (const id of deletable) {
          await api.deleteNode(id);
        }
        await refreshNodes(currentProject, setNodes);
        setSelectedNodeId(null);
        setMultiSelectedIds([]);
        return;
      }

      // 1-4 → status change (apply to all selected)
      const statusMap: Record<string, NodeStatus> = {
        '1': 'pending',
        '2': 'active',
        '3': 'done',
        '4': 'dropped',
      };
      if (statusMap[e.key]) {
        const ids = multiSelectedIds.length > 0 ? multiSelectedIds : (selectedNodeId ? [selectedNodeId] : []);
        if (ids.length === 0) return;
        e.preventDefault();
        for (const id of ids) {
          await api.updateNode(id, { status: statusMap[e.key] });
        }
        await refreshNodes(currentProject, setNodes);
        return;
      }

      // Printable character → enter inline edit mode (single select only)
      if (e.key.length === 1 && !cmd && !e.altKey && selectedNodeId && multiSelectedIds.length === 0) {
        setEditingNodeId(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, editingNodeId, nodes, currentProject, focusNodeId, multiSelectedIds, clipboardIds, setNodes, setSelectedNodeId, setEditingNodeId, setFocusNodeId, setMultiSelectedIds, setClipboard, clearClipboard]);
}
