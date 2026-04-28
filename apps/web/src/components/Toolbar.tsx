import { useProjectStore } from '../store/projectStore';
import { useLayout } from '../hooks/useLayout';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import FilterBar from './FilterBar';

export default function Toolbar() {
  const navigate = useNavigate();
  const currentProject = useProjectStore((s) => s.currentProject);
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const nodes = useProjectStore((s) => s.nodes);
  const setFocusNodeId = useProjectStore((s) => s.setFocusNodeId);
  const focusNodeId = useProjectStore((s) => s.focusNodeId);
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

        {focusNodeId && (
          <button
            onClick={() => setFocusNodeId(null)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
          >
            Esc: Back to overview
          </button>
        )}

        <button
          onClick={autoLayout}
          className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
        >
          Auto Layout
        </button>

        {selectedNodeId && (
          <button
            onClick={handleAddChild}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
          >
            + Add Child (Tab)
          </button>
        )}
      </div>
      <div className="h-8 flex items-center px-4 border-t border-gray-700/50">
        <FilterBar />
      </div>
    </div>
  );
}
