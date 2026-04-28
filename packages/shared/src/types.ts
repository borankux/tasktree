export type NodeStatus = 'pending' | 'active' | 'done' | 'dropped';
export type NodePriority = 'p0' | 'p1' | 'p2' | 'p3';
export type NodeType = 'task' | 'milestone' | 'group' | 'decision' | 'note';
export type EdgeType = 'depends_on' | 'blocks' | 'relates_to' | 'child_of';

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
  priority: NodePriority;
  due_date: string | null;
  assignee_id: string | null;
  progress: number;
  node_type: NodeType;
  attachments: string;
}

export interface ProjectWithNodes extends Project {
  nodes: Node[];
  edges: Edge[];
  tags: Tag[];
  views: View[];
}

export interface Edge {
  id: string;
  project_id: string;
  source_id: string;
  target_id: string;
  label: string;
  created_at: string;
  edge_type: EdgeType;
  style: string;
}

export interface CreateEdgeBody {
  project_id: string;
  source_id: string;
  target_id: string;
  label?: string;
  edge_type?: EdgeType;
  style?: string;
}

export interface UpdateEdgeBody {
  label?: string;
  edge_type?: EdgeType;
  style?: string;
}

export interface CreateProjectBody {
  name: string;
}

export interface CreateNodeBody {
  project_id: string;
  parent_id: string | null;
  title: string;
  priority?: NodePriority;
  node_type?: NodeType;
  due_date?: string | null;
}

export interface UpdateNodeBody {
  title?: string;
  notes?: string;
  status?: NodeStatus;
  edge_label?: string;
  parent_id?: string | null;
  priority?: NodePriority;
  node_type?: NodeType;
  due_date?: string | null;
  assignee_id?: string | null;
  progress?: number;
  attachments?: string;
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

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CreateTagBody {
  project_id: string;
  name: string;
  color?: string;
}

export interface UpdateTagBody {
  name?: string;
  color?: string;
}

export interface NodeTagBody {
  tag_id: string;
}

// View types
export interface View {
  id: string;
  project_id: string;
  name: string;
  description: string;
  layout_config: string;
  is_default: number;
  sort_order: number;
  created_at: string;
}

export interface ViewNode {
  view_id: string;
  node_id: string;
  parent_id: string | null;
  sort_order: number | null;
  position_x: number | null;
  position_y: number | null;
  edge_label: string | null;
}

export interface CreateViewBody {
  project_id: string;
  name: string;
  description?: string;
  layout_config?: string;
}

export interface UpdateViewBody {
  name?: string;
  description?: string;
  layout_config?: string;
}

export interface AutoGenViewBody {
  project_id: string;
  group_by: 'priority' | 'status' | 'node_type';
  name?: string;
}
