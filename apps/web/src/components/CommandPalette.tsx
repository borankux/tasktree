import { useState, useCallback, useEffect, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';
import type { NodeStatus } from '@tasktree/shared';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);
  const setSelectedNodeId = useProjectStore((s) => s.setSelectedNodeId);
  const setEditingNodeId = useProjectStore((s) => s.setEditingNodeId);
  const setFocusNodeId = useProjectStore((s) => s.setFocusNodeId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setSearchQuery = useProjectStore((s) => s.setSearchQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands: Command[] = [];

  // Node operations
  if (selectedNodeId && currentProject) {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node) {
      commands.push(
        { id: 'add-child', label: 'Add child node', shortcut: 'Tab', action: async () => {
          const newNode = await api.createNode({ project_id: currentProject.id, parent_id: selectedNodeId, title: 'New task' });
          const data = await api.getProject(currentProject.id);
          setNodes(data.nodes);
          setSelectedNodeId(newNode.id);
          setEditingNodeId(newNode.id);
          onClose();
        }},
        { id: 'add-sibling', label: 'Add sibling node', shortcut: 'Enter', action: async () => {
          if (!node.parent_id) return;
          const newNode = await api.createNode({ project_id: currentProject.id, parent_id: node.parent_id, title: 'New task' });
          const data = await api.getProject(currentProject.id);
          setNodes(data.nodes);
          setSelectedNodeId(newNode.id);
          setEditingNodeId(newNode.id);
          onClose();
        }},
        { id: 'rename', label: 'Rename node', shortcut: 'type', action: () => { setEditingNodeId(selectedNodeId); onClose(); } },
        { id: 'delete', label: 'Delete node', shortcut: 'Del', action: async () => {
          await api.deleteNode(selectedNodeId);
          setNodes(nodes.filter((n) => n.id !== selectedNodeId));
          setSelectedNodeId(null);
          onClose();
        }},
        { id: 'focus', label: 'Focus subtree', shortcut: 'Cmd+Click', action: () => { setFocusNodeId(selectedNodeId); onClose(); } },
        { id: 'pending', label: 'Set status: Pending', shortcut: '1', action: async () => {
          await api.updateNode(selectedNodeId, { status: 'pending' as NodeStatus });
          const data = await api.getProject(currentProject.id); setNodes(data.nodes); onClose();
        }},
        { id: 'active', label: 'Set status: Active', shortcut: '2', action: async () => {
          await api.updateNode(selectedNodeId, { status: 'active' as NodeStatus });
          const data = await api.getProject(currentProject.id); setNodes(data.nodes); onClose();
        }},
        { id: 'done', label: 'Set status: Done', shortcut: '3', action: async () => {
          await api.updateNode(selectedNodeId, { status: 'done' as NodeStatus });
          const data = await api.getProject(currentProject.id); setNodes(data.nodes); onClose();
        }},
        { id: 'dropped', label: 'Set status: Dropped', shortcut: '4', action: async () => {
          await api.updateNode(selectedNodeId, { status: 'dropped' as NodeStatus });
          const data = await api.getProject(currentProject.id); setNodes(data.nodes); onClose();
        }},
      );
    }
  }

  // Global commands
  commands.push(
    { id: 'search', label: 'Search nodes...', shortcut: '/', action: () => { inputRef.current?.focus(); } },
    { id: 'unfocus', label: 'Back to overview', shortcut: 'Esc', action: () => { setFocusNodeId(null); onClose(); } },
  );

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const execute = useCallback((cmd: Command) => {
    if (cmd.id === 'search' && query) {
      setSearchQuery(query);
      onClose();
    } else {
      cmd.action();
    }
  }, [query, setSearchQuery, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && filtered[selectedIndex]) { e.preventDefault(); execute(filtered[selectedIndex]); return; }
  }, [filtered, selectedIndex, execute, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="w-[480px] bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-gray-700 px-4">
          <span className="text-gray-500 mr-2">&#8981;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent py-3 text-white text-sm outline-none placeholder-gray-500"
          />
          <kbd className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">No commands found</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => execute(cmd)}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm ${
                i === selectedIndex ? 'bg-blue-600/20 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && <kbd className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">{cmd.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
