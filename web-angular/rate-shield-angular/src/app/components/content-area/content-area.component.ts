import { Component, Input, Output, EventEmitter } from '@angular/core';
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
export class ContentAreaComponent {
  @Input() selectedPage: string = 'DASHBOARD';
  @Output() pageChange = new EventEmitter<string>();

  testerPrefillIp = '';
  testerPrefillEndpoint = '';

  onNavigateTo(page: string) {
    this.selectedPage = page;
    this.pageChange.emit(page);
  }

  onTryInTester(data: { ip: string; endpoint: string }) {
    // Navigate first so health-check component is created
    this.selectedPage = 'HEALTH_CHECK';
    // Use setTimeout to ensure the component exists before inputs are set
    setTimeout(() => {
      this.testerPrefillIp = data.ip + '|' + Date.now(); // force change detection
      this.testerPrefillEndpoint = data.endpoint;
    }, 0);
  }
}
