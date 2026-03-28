import { Rule } from '../models/rule.model';

export function validateNewRule(newRule: Rule): { valid: boolean; message?: string } {
  if (!newRule.endpoint || newRule.endpoint === '') {
    return { valid: false, message: "API Endpoint can't be null." };
  }

  if (!newRule.strategy || newRule.strategy === '' || newRule.strategy === 'UNDEFINED') {
    return { valid: false, message: "API limit strategy can't be null." };
  }

  if (!newRule.http_method || newRule.http_method === '') {
    return { valid: false, message: "API HTTP Method can't be null." };
  }
  return { valid: true };
}

export function validateNewTokenBucketRule(newRule: Rule): { valid: boolean; message?: string } {
  if (newRule.strategy === 'TOKEN BUCKET') {
    if (!newRule.token_bucket_rule?.bucket_capacity || newRule.token_bucket_rule.bucket_capacity <= 0) {
      return { valid: false, message: 'Invalid value for bucket capacity.' };
    }

    if (!newRule.token_bucket_rule?.token_add_rate || newRule.token_bucket_rule.token_add_rate <= 0) {
      return { valid: false, message: 'Invalid value for token add rate.' };
    }

    if (newRule.token_bucket_rule.token_add_rate > newRule.token_bucket_rule.bucket_capacity) {
      return { valid: false, message: 'Token add rate should not be more than bucket capacity.' };
    }
  }
  return { valid: true };
}

export function validateNewFixedWindowCounterRule(newRule: Rule): { valid: boolean; message?: string } {
  if (newRule.strategy === 'FIXED WINDOW COUNTER') {
    if (!newRule.fixed_window_counter_rule?.max_requests || newRule.fixed_window_counter_rule.max_requests <= 0) {
      return { valid: false, message: `Invalid value for maximum requests: ${newRule.fixed_window_counter_rule?.max_requests}` };
    }

    if (!newRule.fixed_window_counter_rule?.window || newRule.fixed_window_counter_rule.window <= 0) {
      return { valid: false, message: 'Invalid value for window time.' };
    }
  }
  return { valid: true };
}

export function validateNewSlidingWindowCounterRule(newRule: Rule): { valid: boolean; message?: string } {
  if (newRule.strategy === 'SLIDING WINDOW COUNTER') {
    if (!newRule.sliding_window_counter_rule?.max_requests || newRule.sliding_window_counter_rule.max_requests <= 0) {
      return { valid: false, message: 'Invalid value for maximum requests.' };
    }

    if (!newRule.sliding_window_counter_rule?.window || newRule.sliding_window_counter_rule.window <= 0) {
      return { valid: false, message: 'Invalid value for window time.' };
    }
  }
  return { valid: true };
}
