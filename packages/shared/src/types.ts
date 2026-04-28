export type NodeStatus = 'pending' | 'active' | 'done' | 'dropped';

export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface Node {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  notes: string;
  status: NodeStatus;
  position_x: number;
  position_y: number;
  sort_order: number;
  edge_label: string;
  created_at: string;
}

export interface ProjectWithNodes extends Project {
  nodes: Node[];
  edges: Edge[];
}

export interface Edge {
  id: string;
  project_id: string;
  source_id: string;
  target_id: string;
  label: string;
  created_at: string;
}

export interface CreateEdgeBody {
  project_id: string;
  source_id: string;
  target_id: string;
  label?: string;
}

export interface UpdateEdgeBody {
  label?: string;
}

export interface CreateProjectBody {
  name: string;
}

export interface CreateNodeBody {
  project_id: string;
  parent_id: string | null;
  title: string;
}

export interface UpdateNodeBody {
  title?: string;
  notes?: string;
  status?: NodeStatus;
  edge_label?: string;
  parent_id?: string | null;
}

export interface UpdatePositionBody {
  position_x: number;
  position_y: number;
}

export interface ReorderBody {
  sort_order: number;
}

// Auth types
export interface RegisterBody {
  username: string;
  password: string;
}

export interface LoginBody {
  username: string;
  password: string;
  captcha_answer?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CaptchaResponse {
  captcha_id: string;
  svg: string;
  required: boolean;
}
