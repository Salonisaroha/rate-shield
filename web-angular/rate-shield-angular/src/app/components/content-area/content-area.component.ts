import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiConfigurationComponent } from '../../pages/api-configuration/api-configuration.component';
import { AboutComponent } from '../../pages/about/about.component';
import { AuditLogsComponent } from '../../pages/audit-logs/audit-logs.component';
import { DashboardStatsComponent } from '../../pages/dashboard-stats/dashboard-stats.component';
import { AnalyticsComponent } from '../../pages/analytics/analytics.component';
import { HealthCheckComponent } from '../../pages/health-check/health-check.component';
import { UseCasesComponent } from '../../pages/use-cases/use-cases.component';

@Component({
  selector: 'app-content-area',
  standalone: true,
  imports: [CommonModule, ApiConfigurationComponent, AboutComponent, AuditLogsComponent, DashboardStatsComponent, AnalyticsComponent, HealthCheckComponent, UseCasesComponent],
  templateUrl: './content-area.component.html',
  styleUrls: ['./content-area.component.css']
})
export class ContentAreaComponent implements OnChanges {
  @Input() selectedPage: string = 'DASHBOARD';
  @Output() pageChange = new EventEmitter<string>();

  testerPrefillIp = '';
  testerPrefillEndpoint = '';
  private navigatingViaTryIt = false;

  ngOnChanges(changes: SimpleChanges) {
    const page = changes['selectedPage']?.currentValue;
    if (page === 'HEALTH_CHECK' && !this.navigatingViaTryIt) {
      this.testerPrefillIp = '';
      this.testerPrefillEndpoint = '';
    }
    this.navigatingViaTryIt = false;
  }

  onNavigateTo(page: string) {
    if (page === 'HEALTH_CHECK') {
      this.testerPrefillIp = '';
      this.testerPrefillEndpoint = '';
    }
    this.selectedPage = page;
    this.pageChange.emit(page);
  }

  onTryInTester(data: { ip: string; endpoint: string }) {
    this.navigatingViaTryIt = true;
    this.selectedPage = 'HEALTH_CHECK';
    setTimeout(() => {
      this.testerPrefillIp = data.ip + '|' + Date.now();
      this.testerPrefillEndpoint = data.endpoint;
    }, 0);
  }
}
