export interface Rule {
  strategy: string;
  endpoint: string;
  http_method: string;
  fixed_window_counter_rule: FixedWindowCounterRule | null;
  sliding_window_counter_rule: SlidingWindowCounterRule | null;
  token_bucket_rule: TokenBucketRule | null;
  allow_on_error: boolean;
}

export interface PaginatedRules {
  page_number: number;
  total_items: number;
  has_next_page: boolean;
  rules: Rule[];
  status: string;
}

export interface PaginatedRulesResponse {
  data: PaginatedRules;
  status: string;
}

export interface FixedWindowCounterRule {
  max_requests: number;
  window: number;
}

export interface SlidingWindowCounterRule {
  max_requests: number;
  window: number;
}

export interface TokenBucketRule {
  bucket_capacity: number;
  token_add_rate: number;
  retention_time: number;
}

export interface GetAllRuleResponse {
  data: Rule[];
  status: string;
}
