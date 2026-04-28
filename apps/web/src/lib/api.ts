import type {
  Project,
  ProjectWithNodes,
  CreateProjectBody,
  Node,
  CreateNodeBody,
  UpdateNodeBody,
  Edge,
  CreateEdgeBody,
  UpdateEdgeBody,
  AuthResponse,
  CaptchaResponse,
} from '@tasktree/shared';

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('tasktree_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('tasktree_token');
    localStorage.removeItem('tasktree_user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // Auth
  register: (username: string, password: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),

  login: (username: string, password: string, captcha_answer?: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, captcha_answer }) }),

  getCaptcha: (username: string) =>
    request<CaptchaResponse>(`/auth/captcha?username=${encodeURIComponent(username)}`),

  checkCaptchaRequired: (username: string) =>
    request<{ required: boolean }>(`/auth/captcha-required?username=${encodeURIComponent(username)}`),

  verifyCaptcha: (captcha_id: string, username: string, answer: string) =>
    request<{ valid: boolean }>('/auth/verify-captcha', {
      method: 'POST',
      body: JSON.stringify({ captcha_id, username, answer }),
    }),

  getMe: () => request<{ user: { id: string; username: string; created_at: string } }>('/auth/me'),

  // Projects
  listProjects: () => request<Project[]>('/projects'),

  createProject: (body: CreateProjectBody) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),

  getProject: (id: string) => request<ProjectWithNodes>(`/projects/${id}`),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' }),

  // Nodes
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

  // Edges
  createEdge: (body: CreateEdgeBody) =>
    request<Edge>('/edges', { method: 'POST', body: JSON.stringify(body) }),

  updateEdge: (id: string, body: UpdateEdgeBody) =>
    request<Edge>(`/edges/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteEdge: (id: string) =>
    request<{ ok: boolean }>(`/edges/${id}`, { method: 'DELETE' }),
};
