import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../lib/api';
import { useProjectStore } from '../store/projectStore';
import type { NodeStatus } from '@tasktree/shared';

const statusOptions: { value: NodeStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-500' },
  { value: 'active', label: 'Active', color: 'bg-yellow-500' },
  { value: 'done', label: 'Done', color: 'bg-green-500' },
  { value: 'dropped', label: 'Dropped', color: 'bg-red-500' },
];

export default function NodeEditor() {
  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const currentProject = useProjectStore((s) => s.currentProject);

  const node = nodes.find((n) => n.id === selectedNodeId);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setNotes(node.notes);
    }
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) {
    return (
      <div className="w-72 bg-gray-800 border-l border-gray-700 p-4 text-gray-600 text-sm">
        Select a node to edit
      </div>
    );
  }

  const handleSaveTitle = async () => {
    if (title.trim() === node.title) return;
    await api.updateNode(node.id, { title: title.trim() });
    setNodes(nodes.map((n) => (n.id === node.id ? { ...n, title: title.trim() } : n)));
  };

  const handleSaveNotes = async () => {
    if (notes === node.notes) return;
    await api.updateNode(node.id, { notes });
    setNodes(nodes.map((n) => (n.id === node.id ? { ...n, notes } : n)));
  };

  const handleStatusChange = async (status: NodeStatus) => {
    await api.updateNode(node.id, { status });
    // Re-fetch to pick up cascade changes
    if (currentProject) {
      const data = await api.getProject(currentProject.id);
      setNodes(data.nodes);
    } else {
      setNodes(nodes.map((n) => (n.id === node.id ? { ...n, status } : n)));
    }
  };

  const handleAddChild = async () => {
    const newNode = await api.createNode({
      project_id: node.project_id,
      parent_id: node.id,
      title: 'New task',
    });
    // Re-fetch to pick up cascade changes (parent may have been reactivated)
    if (currentProject) {
      const data = await api.getProject(currentProject.id);
      setNodes(data.nodes);
    } else {
      setNodes([...nodes, newNode]);
    }
  };

  const handleDelete = async () => {
    await api.deleteNode(node.id);
    setNodes(nodes.filter((n) => n.id !== node.id));
  };

  const togglePreview = () => {
    if (previewMode) {
      // Switching back to edit mode
      setPreviewMode(false);
    } else {
      // Switching to preview mode — save first
      handleSaveNotes();
      setPreviewMode(true);
    }
  };

  return (
    <div className="w-72 bg-gray-800 border-l border-gray-700 p-4 flex flex-col gap-4">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
          className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
        <div className="flex gap-1 mt-1">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                node.status === opt.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${opt.color}`} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Notes</label>
          <button
            onClick={togglePreview}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>

        {previewMode ? (
          <div className="mt-1 flex-1 overflow-y-auto bg-gray-900 border border-gray-700 rounded px-3 py-2 prose prose-invert prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{notes || '*No notes yet*'}</Markdown>
          </div>
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSaveNotes}
            rows={8}
            className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
            placeholder="Write notes in markdown..."
          />
        )}
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={handleAddChild}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium"
        >
          + Add Child
        </button>
        <button
          onClick={handleDelete}
          className="bg-gray-700 hover:bg-red-700 text-gray-300 px-3 py-2 rounded text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
