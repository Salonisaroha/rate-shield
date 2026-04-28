import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RulesService } from '../../services/rules.service';
import { AuditService } from '../../services/audit.service';
import { Rule } from '../../models/rule.model';
import { AuditLog } from '../../models/audit.model';
import { ToastrService } from 'ngx-toastr';
import { interval, Subscription } from 'rxjs';

interface StrategyData { label: string; count: number; color: string; bg: string; }
interface MethodData { method: string; count: number; color: string; bg: string; }
interface RiskRule { endpoint: string; method: string; reason: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; }

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css']
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  rules: Rule[] = [];
  auditLogs: AuditLog[] = [];
  loading = true;
  lastUpdated: Date | null = null;

  totalRules = 0;
  allowOnErrorCount = 0;
  allowOnErrorPercent = 0;

  strategyData: StrategyData[] = [];
  methodData: MethodData[] = [];
  riskRules: RiskRule[] = [];

  recentActivity: AuditLog[] = [];
  createCount = 0;
  updateCount = 0;
  deleteCount = 0;

  newLogIds = new Set<string>();
  private refreshSub?: Subscription;

  private isFirstLoad = true;

  constructor(
    private rulesService: RulesService,
    private auditService: AuditService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadData();
    this.refreshSub = interval(10000).subscribe(() => this.loadData(true));
  }

  ngOnDestroy() {
    this.refreshSub?.unsubscribe();
  }

  loadData(silent = false) {
    if (!silent) this.loading = true;

    // Cancel previous in-flight rules request before starting a new one
    this.rulesService.getAllRules().subscribe({
      next: (res) => {
        this.rules = res.data || [];
        this.computeRuleStats();
        this.loading = false;
        this.lastUpdated = new Date();
        this.isFirstLoad = false;
      },
      error: () => {
        if (!silent) this.toastr.error('Failed to load rules');
        this.loading = false;
      }
    });

    this.auditService.getAuditLogs(1, 50).subscribe({
      next: (res) => {
        const prevIds = new Set(this.recentActivity.map(l => l.id));
        // Backend wraps in { data: { logs: [...] } } for paginated, or { data: [...] } for all
        const logs: AuditLog[] = res.data?.logs ?? (Array.isArray(res.data) ? res.data : res.logs ?? []);
        this.newLogIds = new Set(logs.filter(l => !prevIds.has(l.id)).map(l => l.id));
        this.recentActivity = logs.slice(0, 8);
        this.createCount = logs.filter(l => l.action === 'CREATE').length;
        this.updateCount = logs.filter(l => l.action === 'UPDATE').length;
        this.deleteCount = logs.filter(l => l.action === 'DELETE').length;
        // Clear new highlights after 3s
        if (this.newLogIds.size > 0) setTimeout(() => this.newLogIds.clear(), 3000);
      },
      error: () => {}
    });
  }

  computeRuleStats() {
    const rules = this.rules;
    this.totalRules = rules.length;
    this.allowOnErrorCount = rules.filter(r => r.allow_on_error).length;
    this.allowOnErrorPercent = this.totalRules > 0
      ? Math.round((this.allowOnErrorCount / this.totalRules) * 100) : 0;

    const tb = rules.filter(r => r.strategy === 'TOKEN BUCKET').length;
    const fw = rules.filter(r => r.strategy === 'FIXED WINDOW COUNTER').length;
    const sw = rules.filter(r => r.strategy === 'SLIDING WINDOW COUNTER').length;

    this.strategyData = [
      { label: 'Token Bucket', count: tb, color: 'text-purple-600', bg: 'bg-purple-500' },
      { label: 'Fixed Window', count: fw, color: 'text-blue-600', bg: 'bg-blue-500' },
      { label: 'Sliding Window', count: sw, color: 'text-green-600', bg: 'bg-green-500' },
    ];

    const methodColors: Record<string, { color: string; bg: string }> = {
      GET:    { color: 'text-green-600',  bg: 'bg-green-500' },
      POST:   { color: 'text-blue-600',   bg: 'bg-blue-500' },
      PUT:    { color: 'text-yellow-600', bg: 'bg-yellow-500' },
      DELETE: { color: 'text-red-600',    bg: 'bg-red-500' },
      PATCH:  { color: 'text-orange-600', bg: 'bg-orange-500' },
    };
    this.methodData = Object.entries(methodColors)
      .map(([m, c]) => ({ method: m, count: rules.filter(r => r.http_method === m).length, ...c }))
      .filter(m => m.count > 0);

    this.riskRules = [];
    rules.forEach(r => {
      if (r.token_bucket_rule && r.token_bucket_rule.bucket_capacity <= 5)
        this.riskRules.push({ endpoint: r.endpoint, method: r.http_method, reason: 'Very low bucket capacity (≤5)', severity: 'HIGH' });
      if (r.fixed_window_counter_rule && r.fixed_window_counter_rule.max_requests <= 3)
        this.riskRules.push({ endpoint: r.endpoint, method: r.http_method, reason: 'Very low max requests (≤3)', severity: 'HIGH' });
      if (!r.allow_on_error)
        this.riskRules.push({ endpoint: r.endpoint, method: r.http_method, reason: 'Allow-on-error OFF — Redis failure blocks all traffic', severity: 'MEDIUM' });
    });
  }

  getBarWidth(count: number, total: number): string {
    return total === 0 ? '0%' : Math.round((count / total) * 100) + '%';
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'HIGH':   return 'bg-red-100 text-red-700';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
      default:       return 'bg-blue-100 text-blue-700';
    }
  }

  getActionClass(action: string): string {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default:       return 'bg-gray-100 text-gray-700';
    }
  }

  formatTimestamp(ts: number): string {
    return new Date((ts > 1e10 ? ts : ts * 1000)).toLocaleTimeString();
  }

  isNewLog(id: string): boolean {
    return this.newLogIds.has(id);
  }
}
