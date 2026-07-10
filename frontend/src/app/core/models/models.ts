export interface User {
  username: string;
  display_name: string;
  role: 'PM' | 'QA' | 'DS' | 'OTHER';
}

export interface ModelConfig {
  icon: string;
  description: string;
  review_columns: string[];
  qa_statuses: string[];
  ds_statuses: string[];
  qa_reasons: string[];
}

export interface AppConfig {
  tenants: string[];
  tenant_projects: Record<string, string[]>;
  models: Record<string, ModelConfig>;
  departments: Record<string, string>;
  roles: string[];
}

export interface Plot {
  id: number;
  tenant: string;
  project: string;
  model_name: string;
  plot_id: string;
  farmer_id: string;
  farmer_name: string;
  lat: number;
  lon: number;
  detection_status: string;
  pipeline_flag: string;
  publish_status: 'published' | 'unpublished';
  model_data: string;
  evidence_url: string;
  qa_status: string;
  qa_reason: string | null;
  qa_comments: string | null;
  qa_user: string | null;
  qa_at: string | null;
  ds_status: string;
  ds_comments: string | null;
  ds_user: string | null;
  ds_at: string | null;
  final_status: string | null;
  published_at: string | null;
  published_by: string | null;
  synced_at: string;
}

export interface Stats {
  total: number;
  published: number;
  unpublished: number;
  published_deforested: number;
  published_not_deforested: number;
  qa_pending: number;
  qa_done: number;
  ds_pending: number;
  ready_publish: number;
}

export interface ActivityLogEntry {
  id: number;
  tenant: string;
  project: string;
  model_name: string;
  plot_id: string;
  username: string;
  action: string;
  details: string;
  ts: string;
}

export interface ManagedUser {
  username: string;
  role: string;
  display_name: string;
}
