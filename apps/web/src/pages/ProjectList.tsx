import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useProjectStore } from '../store/projectStore';
import type { Project } from '@tasktree/shared';

export default function ProjectList() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const setProjects = useProjectStore((s) => s.setProjects);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    api.listProjects().then(setProjects);
  }, [setProjects]);

  const handleCreate = async () => {
    const name = newName.trim() || 'Untitled Project';
    const project = await api.createProject({ name });
    setNewName('');
    navigate(`/project/${project.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.deleteProject(id);
    setProjects(projects.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">MindMap Task Manager</h1>

        <div className="flex gap-2 mb-8">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="New project name..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
          >
            Create
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects as Project[]).map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              className="bg-gray-800 border border-gray-700 rounded-lg p-5 cursor-pointer hover:border-gray-500 transition-colors group"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                <button
                  onClick={(e) => handleDelete(e, project.id)}
                  className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  &times;
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{project.created_at}</p>
            </div>
          ))}
        </div>

        {projects.length === 0 && (
          <p className="text-gray-600 text-center mt-16">No projects yet. Create one above.</p>
        )}
      </div>
    </div>
  );
}
