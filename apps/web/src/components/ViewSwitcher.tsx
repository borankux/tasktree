import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';
import type { View } from '@tasktree/shared';

export default function ViewSwitcher() {
  const views = useProjectStore((s) => s.views);
  const setViews = useProjectStore((s) => s.setViews);
  const activeViewId = useProjectStore((s) => s.activeViewId);
  const setActiveViewId = useProjectStore((s) => s.setActiveViewId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const [showDialog, setShowDialog] = useState(false);

  const handleCreate = async (name: string, groupBy?: string) => {
    if (!currentProject) return;
    let view: View;
    if (groupBy) {
      view = await api.autoGenView({ project_id: currentProject.id, group_by: groupBy as any, name });
    } else {
      view = await api.createView({ project_id: currentProject.id, name });
    }
    setViews([...views, view]);
    setActiveViewId(view.id);
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    await api.deleteView(id);
    setViews(views.filter((v) => v.id !== id));
    if (activeViewId === id) setActiveViewId(null);
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Default view (all nodes) */}
        <button
          onClick={() => setActiveViewId(null)}
          className={`px-2 py-0.5 rounded text-xs transition-colors ${
            activeViewId === null ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        {views.map((v) => (
          <div key={v.id} className="flex items-center group">
            <button
              onClick={() => setActiveViewId(v.id)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                activeViewId === v.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
              title={v.description || v.name}
            >
              {v.name}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
              className="ml-0.5 text-gray-600 hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              &times;
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowDialog(true)}
          className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-500 hover:text-white"
        >
          + View
        </button>
      </div>

      {showDialog && (
        <ViewCreateDialog
          onClose={() => setShowDialog(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}

function ViewCreateDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, groupBy?: string) => void;
}) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [groupBy, setGroupBy] = useState('priority');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), mode === 'auto' ? groupBy : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[360px] bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-medium mb-4">Create View</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. By Priority"
              className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Mode</label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 px-3 py-2 rounded text-xs ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                Blank View
              </button>
              <button
                type="button"
                onClick={() => setMode('auto')}
                className={`flex-1 px-3 py-2 rounded text-xs ${mode === 'auto' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
              >
                Auto-Generate
              </button>
            </div>
          </div>
          {mode === 'auto' && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="priority">Priority</option>
                <option value="status">Status</option>
                <option value="node_type">Type</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
