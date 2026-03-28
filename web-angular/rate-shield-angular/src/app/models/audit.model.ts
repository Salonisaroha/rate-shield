export interface AuditLog {
  id: string;
  timestamp: number;
  actor: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  old_rule: any | null;
  new_rule: any | null;
  ip_address: string;
  user_agent: string;
}

export interface PaginatedAuditLogs {
  page_number: number;
  total_items: number;
  has_next_page: boolean;
  logs: AuditLog[];
}
