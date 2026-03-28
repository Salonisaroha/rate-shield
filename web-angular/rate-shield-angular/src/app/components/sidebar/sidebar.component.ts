import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnChanges {
  @Input() externalPage: string = 'DASHBOARD';
  @Output() selectPage = new EventEmitter<string>();

  selectedPage = 'DASHBOARD';
  hoveredPage: string | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['externalPage']) {
      this.selectedPage = changes['externalPage'].currentValue;
    }
  }

  menuItems = [
    { label: 'Dashboard',       icon: '🏠', page: 'DASHBOARD' },
    { label: 'API Config',      icon: '⚙️', page: 'API_CONFIGURATION' },
    { label: 'Analytics',       icon: '📊', page: 'ANALYTICS' },
    { label: 'Use Cases',       icon: '💡', page: 'USE_CASES' },
    { label: 'Live Tester',     icon: '🧪', page: 'HEALTH_CHECK' },
    { label: 'Audit Logs',      icon: '📋', page: 'AUDIT_LOGS' },
    { label: 'About',           icon: 'ℹ️', page: 'ABOUT' },
  ];

  onSelectPage(page: string) {
    this.selectedPage = page;
    this.selectPage.emit(page);
  }
}
