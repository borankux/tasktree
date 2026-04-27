export type NodeStatus = 'pending' | 'active' | 'done' | 'dropped';

export interface Project {
  id: string;
  name: string;
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
  created_at: string;
}

export interface ProjectWithNodes extends Project {
  nodes: Node[];
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
}

export interface UpdatePositionBody {
  position_x: number;
  position_y: number;
}

export interface ReorderBody {
  sort_order: number;
}
