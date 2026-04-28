import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { useProjectStore } from '../store/projectStore';
import { api } from '../lib/api';
import MindMap from '../components/MindMap';
import NodeEditor from '../components/NodeEditor';
import Toolbar from '../components/Toolbar';
import { useShortcuts } from '../hooks/useShortcuts';

function CanvasInner() {
  useShortcuts();

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <MindMap />
        </div>
        <NodeEditor />
      </div>
    </div>
  );
}

export default function Canvas() {
  const { id } = useParams<{ id: string }>();
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setNodes = useProjectStore((s) => s.setNodes);
  const setCustomEdges = useProjectStore((s) => s.setCustomEdges);
  const setTags = useProjectStore((s) => s.setTags);

  useEffect(() => {
    if (!id) return;

    api.getProject(id).then((data) => {
      const { nodes: _, edges: __, tags: ___, ...project } = data;
      setCurrentProject(project);
      setNodes(data.nodes);
      setCustomEdges(data.edges ?? []);
      setTags(data.tags ?? []);
    });

    return () => {
      setCurrentProject(null);
      setNodes([]);
      setCustomEdges([]);
      setTags([]);
    };
  }, [id, setCurrentProject, setNodes, setCustomEdges, setTags]);

  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
