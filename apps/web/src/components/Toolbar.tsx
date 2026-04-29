import { useProjectStore } from '../store/projectStore';
import { useLayout } from '../hooks/useLayout';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import FilterBar from './FilterBar';
import ViewSwitcher from './ViewSwitcher';
import { toPng } from 'html-to-image';

export default function Toolbar() {
  const navigate = useNavigate();
  const currentProject = useProjectStore((s) => s.currentProject);
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const setFocusNodeId = useProjectStore((s) => s.setFocusNodeId);
  const focusNodeId = useProjectStore((s) => s.focusNodeId);
  const searchQuery = useProjectStore((s) => s.searchQuery);
  const setSearchQuery = useProjectStore((s) => s.setSearchQuery);
  const hiddenEdgeTypes = useProjectStore((s) => s.hiddenEdgeTypes);
  const toggleEdgeTypeVisibility = useProjectStore((s) => s.toggleEdgeTypeVisibility);
  const { autoLayout } = useLayout();

  const handleAddChild = async () => {
    if (!selectedNodeId || !currentProject) return;
    const newNode = await api.createNode({
      project_id: currentProject.id,
      parent_id: selectedNodeId,
      title: 'New task',
    });
    useProjectStore.getState().setNodes([...nodes, newNode]);
  };

  const edgeTypes = [
    { type: 'depends_on', label: 'Dep', color: 'bg-red-500' },
    { type: 'blocks', label: 'Blk', color: 'bg-orange-500' },
    { type: 'relates_to', label: 'Rel', color: 'bg-gray-500' },
  ];

  const handleExportPng = async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) return;
    try {
      const dataUrl = await toPng(viewport, { backgroundColor: '#111827', pixelRatio: 3 });
      const link = document.createElement('a');
      link.download = `${currentProject?.name || 'tasktree'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export PNG failed:', err);
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 flex flex-col">
      <div className="h-10 flex items-center px-4 gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white text-sm"
        >
          &larr; Projects
        </button>

        <div className="h-5 w-px bg-gray-700" />

        <span className="text-white font-medium">{currentProject?.name}</span>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-36 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:w-48 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
            >
              &times;
            </button>
          )}
        </div>

        {/* Edge type toggles */}
        <div className="flex items-center gap-1">
          {edgeTypes.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => toggleEdgeTypeVisibility(type)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                hiddenEdgeTypes.has(type)
                  ? 'bg-gray-900 text-gray-600 line-through'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />
              {label}
            </button>
          ))}
        </div>

        {focusNodeId && (
          <button
            onClick={() => setFocusNodeId(null)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
          >
            Esc: Overview
          </button>
        )}

        <button
          onClick={autoLayout}
          className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
        >
          Layout
        </button>

        <button
          onClick={handleExportPng}
          className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
        >
          Export PNG
        </button>

        {selectedNodeId && (
          <button
            onClick={handleAddChild}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
          >
            + Child
          </button>
        )}

        <kbd className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded cursor-default">Cmd+K</kbd>
      </div>
      <div className="h-8 flex items-center px-4 border-t border-gray-700/50 gap-4">
        <FilterBar />
        <div className="h-4 w-px bg-gray-700" />
        <ViewSwitcher />
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Done</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> Active</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-gray-500" /> Pending</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Dropped</span>
        </div>
      </div>
    </div>
  );
}
