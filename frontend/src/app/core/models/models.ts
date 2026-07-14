export interface User {
  username: string;
  display_name: string;
  role: 'PM' | 'QA' | 'DS' | 'OTHER';
}

export interface AppConfig {
  departments: Record<string, string>;
  roles: string[];
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
