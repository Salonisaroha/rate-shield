import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RulesService } from '../../services/rules.service';
import { ToastrService } from 'ngx-toastr';
import { Rule } from '../../models/rule.model';

@Component({
  selector: 'app-dashboard-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-stats.component.html',
  styleUrls: ['./dashboard-stats.component.css']
})
export class DashboardStatsComponent implements OnInit {
  @Output() navigateTo = new EventEmitter<string>();
  totalRules = 0;
  tokenBucketCount = 0;
  fixedWindowCount = 0;
  slidingWindowCount = 0;
  getMethodCount = 0;
  postMethodCount = 0;
  otherMethodCount = 0;
  recentRules: Rule[] = [];
  loading = false;

  constructor(private rulesService: RulesService, private toastr: ToastrService) {}

  ngOnInit() {
    this.fetchStats();
  }

  fetchStats() {
    this.loading = true;
    this.rulesService.getAllRules().subscribe({
      next: (response) => {
        const rules: Rule[] = response.data || [];
        this.totalRules = rules.length;

        this.tokenBucketCount = rules.filter(r => r.strategy === 'TOKEN BUCKET').length;
        this.fixedWindowCount = rules.filter(r => r.strategy === 'FIXED WINDOW COUNTER').length;
        this.slidingWindowCount = rules.filter(r => r.strategy === 'SLIDING WINDOW COUNTER').length;

        this.getMethodCount = rules.filter(r => r.http_method === 'GET').length;
        this.postMethodCount = rules.filter(r => r.http_method === 'POST').length;
        this.otherMethodCount = rules.filter(r => r.http_method !== 'GET' && r.http_method !== 'POST').length;

        this.recentRules = rules.slice(0, 5);
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to fetch stats');
        this.loading = false;
      }
    });
  }

  getStrategyClass(strategy: string): string {
    switch (strategy) {
      case 'TOKEN BUCKET': return 'bg-purple-100 text-purple-700';
      case 'FIXED WINDOW COUNTER': return 'bg-blue-100 text-blue-700';
      case 'SLIDING WINDOW COUNTER': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  goToApiConfig() { this.navigateTo.emit('API_CONFIGURATION'); }
  goToUseCases() { this.navigateTo.emit('USE_CASES'); }
  goToLiveTester() { this.navigateTo.emit('HEALTH_CHECK'); }
  goToAnalytics() { this.navigateTo.emit('ANALYTICS'); }

  getMethodClass(method: string): string {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-700';
      case 'POST': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      case 'PUT': return 'bg-yellow-100 text-yellow-700';
      case 'PATCH': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }
}
