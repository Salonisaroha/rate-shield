import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Rule, FixedWindowCounterRule, SlidingWindowCounterRule, TokenBucketRule } from '../../models/rule.model';
import { RulesService } from '../../services/rules.service';
import { validateNewRule, validateNewTokenBucketRule, validateNewFixedWindowCounterRule, validateNewSlidingWindowCounterRule } from '../../utils/validators';

@Component({
  selector: 'app-add-or-update-rule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-or-update-rule.component.html',
  styleUrls: ['./add-or-update-rule.component.css']
})
export class AddOrUpdateRuleComponent implements OnInit {
  @Input() rule: Rule | null = null;
  @Input() action: string = 'ADD';
  @Output() close = new EventEmitter<void>();

  apiEndpoint = '';
  limitStrategy = '';
  method = 'GET';
  tokenBucket: TokenBucketRule | null = null;
  fixedWindowCounter: FixedWindowCounterRule | null = null;
  slidingWindowCounter: SlidingWindowCounterRule | null = null;
  allowOnError = false;

  strategies = ['TOKEN BUCKET', 'FIXED WINDOW COUNTER', 'SLIDING WINDOW COUNTER'];
  methods = ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'];

  constructor(private rulesService: RulesService, private toastr: ToastrService) {}

  ngOnInit() {
    if (this.rule && this.action === 'UPDATE') {
      this.apiEndpoint = this.rule.endpoint;
      this.limitStrategy = this.rule.strategy;
      this.method = this.rule.http_method;
      this.tokenBucket = this.rule.token_bucket_rule;
      this.fixedWindowCounter = this.rule.fixed_window_counter_rule;
      this.slidingWindowCounter = this.rule.sliding_window_counter_rule;
      this.allowOnError = this.rule.allow_on_error;
    }
  }

  addOrUpdateRule() {
    const newRule: Rule = {
      endpoint: this.apiEndpoint,
      http_method: this.method,
      strategy: this.limitStrategy,
      fixed_window_counter_rule: this.fixedWindowCounter,
      token_bucket_rule: this.tokenBucket,
      sliding_window_counter_rule: this.slidingWindowCounter,
      allow_on_error: this.allowOnError,
    };

    const validation = validateNewRule(newRule);
    if (!validation.valid) {
      this.toastr.error(validation.message);
      return;
    }

    const tokenValidation = validateNewTokenBucketRule(newRule);
    if (!tokenValidation.valid) {
      this.toastr.error(tokenValidation.message);
      return;
    }

    const fixedValidation = validateNewFixedWindowCounterRule(newRule);
    if (!fixedValidation.valid) {
      this.toastr.error(fixedValidation.message);
      return;
    }

    const slidingValidation = validateNewSlidingWindowCounterRule(newRule);
    if (!slidingValidation.valid) {
      this.toastr.error(slidingValidation.message);
      return;
    }

    this.rulesService.createNewRule(newRule).subscribe({
      next: () => {
        this.toastr.success('Rule saved successfully');
        this.close.emit();
      },
      error: (error) => {
        this.toastr.error('Unable to save rule: ' + error.message);
      }
    });
  }

  deleteExistingRule() {
    this.rulesService.deleteRule(this.apiEndpoint).subscribe({
      next: () => {
        this.toastr.success('Rule deleted successfully');
        this.close.emit();
      },
      error: (error) => {
        this.toastr.error('Unable to delete rule: ' + error.message);
      }
    });
  }

  onClose() {
    this.close.emit();
  }

  updateTokenBucketCapacity(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (!this.tokenBucket) {
      this.tokenBucket = { bucket_capacity: 0, token_add_rate: 0, retention_time: 0 };
    }
    this.tokenBucket.bucket_capacity = parseInt(value) || 0;
  }

  updateTokenAddRate(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (!this.tokenBucket) {
      this.tokenBucket = { bucket_capacity: 0, token_add_rate: 0, retention_time: 0 };
    }
    this.tokenBucket.token_add_rate = parseInt(value) || 0;
  }

  updateRetentionTime(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (!this.tokenBucket) {
      this.tokenBucket = { bucket_capacity: 0, token_add_rate: 0, retention_time: 0 };
    }
    this.tokenBucket = {
      bucket_capacity: this.tokenBucket.bucket_capacity,
      token_add_rate: this.tokenBucket.token_add_rate,
      retention_time: parseInt(value) || 0
    };
  }

  updateMaxRequests(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.limitStrategy === 'FIXED WINDOW COUNTER') {
      if (!this.fixedWindowCounter) {
        this.fixedWindowCounter = { max_requests: 0, window: 0 };
      }
      this.fixedWindowCounter.max_requests = parseInt(value) || 0;
    } else if (this.limitStrategy === 'SLIDING WINDOW COUNTER') {
      if (!this.slidingWindowCounter) {
        this.slidingWindowCounter = { max_requests: 0, window: 0 };
      }
      this.slidingWindowCounter.max_requests = parseInt(value) || 0;
    }
  }

  updateWindow(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.limitStrategy === 'FIXED WINDOW COUNTER') {
      if (!this.fixedWindowCounter) {
        this.fixedWindowCounter = { max_requests: 0, window: 0 };
      }
      this.fixedWindowCounter.window = parseInt(value) || 0;
    } else if (this.limitStrategy === 'SLIDING WINDOW COUNTER') {
      if (!this.slidingWindowCounter) {
        this.slidingWindowCounter = { max_requests: 0, window: 0 };
      }
      this.slidingWindowCounter.window = parseInt(value) || 0;
    }
  }
}
