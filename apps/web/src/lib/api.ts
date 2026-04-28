import type {
  Project,
  ProjectWithNodes,
  CreateProjectBody,
  Node,
  CreateNodeBody,
  UpdateNodeBody,
} from '@mindmap/shared';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  listProjects: () => request<Project[]>('/projects'),

  createProject: (body: CreateProjectBody) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),

  getProject: (id: string) => request<ProjectWithNodes>(`/projects/${id}`),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' }),

  createNode: (body: CreateNodeBody) =>
    request<Node>('/nodes', { method: 'POST', body: JSON.stringify(body) }),

  updateNode: (id: string, body: UpdateNodeBody) =>
    request<Node>(`/nodes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  updatePosition: (id: string, x: number, y: number) =>
    request<{ ok: boolean }>(`/nodes/${id}/position`, {
      method: 'PATCH',
      body: JSON.stringify({ position_x: x, position_y: y }),
    }),

  deleteNode: (id: string) =>
    request<{ ok: boolean }>(`/nodes/${id}`, { method: 'DELETE' }),

  reorderNode: (id: string, sort_order: number) =>
    request<{ ok: boolean }>(`/nodes/${id}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ sort_order }),
    }),

  layoutProject: (id: string) =>
    request<Node[]>(`/projects/${id}/layout`, { method: 'POST' }),
};
