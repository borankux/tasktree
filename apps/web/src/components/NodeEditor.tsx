import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../lib/api';
import { useProjectStore } from '../store/projectStore';
import type { NodeStatus, NodePriority, NodeType, Tag } from '@tasktree/shared';

const statusOptions: { value: NodeStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-500' },
  { value: 'active', label: 'Active', color: 'bg-yellow-500' },
  { value: 'done', label: 'Done', color: 'bg-green-500' },
  { value: 'dropped', label: 'Dropped', color: 'bg-red-500' },
];

const priorityOptions: { value: NodePriority; label: string }[] = [
  { value: 'p0', label: 'P0 Critical' },
  { value: 'p1', label: 'P1 High' },
  { value: 'p2', label: 'P2 Normal' },
  { value: 'p3', label: 'P3 Low' },
];

const typeOptions: { value: NodeType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'group', label: 'Group' },
  { value: 'decision', label: 'Decision' },
  { value: 'note', label: 'Note' },
];

export default function NodeEditor() {
  const nodes = useProjectStore((s) => s.nodes);
  const setNodes = useProjectStore((s) => s.setNodes);
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const tags = useProjectStore((s) => s.tags);
  const setTags = useProjectStore((s) => s.setTags);

  const node = nodes.find((n) => n.id === selectedNodeId);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [nodeTags, setNodeTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setNotes(node.notes);
    }
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load node tags when node selection changes
  useEffect(() => {
    if (!node || !currentProject) { setNodeTags([]); return; }
    // Node tags are tracked locally via tag/untag actions
    setNodeTags([]);
  }, [node?.id, currentProject]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (currentProject) {
      const data = await api.getProject(currentProject.id);
      setNodes(data.nodes);
    } else {
      setNodes(nodes.map((n) => (n.id === node.id ? { ...n, status } : n)));
    }
  };

  const handlePriorityChange = async (priority: NodePriority) => {
    await api.updateNode(node.id, { priority });
    setNodes(nodes.map((n) => (n.id === node.id ? { ...n, priority } : n)));
  };

  const handleTypeChange = async (node_type: NodeType) => {
    await api.updateNode(node.id, { node_type });
    setNodes(nodes.map((n) => (n.id === node.id ? { ...n, node_type } : n)));
  };

  const handleProgressChange = async (progress: number) => {
    await api.updateNode(node.id, { progress });
    if (currentProject) {
      const data = await api.getProject(currentProject.id);
      setNodes(data.nodes);
    } else {
      setNodes(nodes.map((n) => (n.id === node.id ? { ...n, progress } : n)));
    }
  };

  const handleDueDateChange = async (due_date: string) => {
    await api.updateNode(node.id, { due_date: due_date || null });
    setNodes(nodes.map((n) => (n.id === node.id ? { ...n, due_date: due_date || null } : n)));
  };

  const handleAddChild = async () => {
    const newNode = await api.createNode({
      project_id: node.project_id,
      parent_id: node.id,
      title: 'New task',
    });
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
      setPreviewMode(false);
    } else {
      handleSaveNotes();
      setPreviewMode(true);
    }
  };

  const handleCreateAndTag = async () => {
    const name = tagInput.trim().replace(/^#/, '');
    if (!name || !currentProject) return;

    // Find existing tag or create new
    let tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      tag = await api.createTag({ project_id: currentProject.id, name });
      setTags([...tags, tag]);
    }

    try {
      await api.tagNode(node.id, tag.id);
      setNodeTags([...nodeTags, tag]);
    } catch {
      // already tagged
    }
    setTagInput('');
  };

  const handleUntag = async (tagId: string) => {
    await api.untagNode(node.id, tagId);
    setNodeTags(nodeTags.filter((t) => t.id !== tagId));
  };

  return (
    <div className="w-72 bg-gray-800 border-l border-gray-700 p-4 flex flex-col gap-3 overflow-y-auto">
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
                node.status === opt.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${opt.color}`} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Priority</label>
        <select
          value={node.priority}
          onChange={(e) => handlePriorityChange(e.target.value as NodePriority)}
          className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          {priorityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Type</label>
        <select
          value={node.node_type}
          onChange={(e) => handleTypeChange(e.target.value as NodeType)}
          className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
        >
          {typeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Progress ({node.progress}%)</label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={node.progress}
          onChange={(e) => handleProgressChange(Number(e.target.value))}
          onMouseUp={() => {}} // already saved in onChange
          className="w-full mt-1 accent-blue-500"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Due Date</label>
        <input
          type="date"
          value={node.due_date ?? ''}
          onChange={(e) => handleDueDateChange(e.target.value)}
          className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide">Tags</label>
        <div className="flex flex-wrap gap-1 mt-1 mb-1">
          {nodeTags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button onClick={() => handleUntag(tag.id)} className="hover:text-red-300">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateAndTag()}
            placeholder="# tag name"
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleCreateAndTag}
            className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs"
          >
            +
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {tags
              .filter((t) => !nodeTags.some((nt) => nt.id === t.id))
              .map((tag) => (
                <button
                  key={tag.id}
                  onClick={async () => {
                    await api.tagNode(node.id, tag.id);
                    setNodeTags([...nodeTags, tag]);
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:text-white border border-gray-700"
                  style={{ borderColor: tag.color }}
                >
                  {tag.name}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Notes</label>
          <button onClick={togglePreview} className="text-xs text-blue-400 hover:text-blue-300">
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
            rows={6}
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
