import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditService } from '../../services/audit.service';
import { AuditLog } from '../../models/audit.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css']
})
export class AuditLogsComponent implements OnInit {
  logs: AuditLog[] = [];
  pageNumber = 1;
  hasNextPage = false;
  searchEndpoint = '';
  loading = false;

  constructor(private auditService: AuditService, private toastr: ToastrService) {}

  ngOnInit() {
    this.fetchLogs();
  }

  fetchLogs() {
    this.loading = true;
    this.auditService.getAuditLogs(this.pageNumber, 10).subscribe({
      next: (response) => {
        this.logs = response.data?.logs || response.logs || [];
        this.hasNextPage = response.data?.has_next_page || response.has_next_page || false;
        this.loading = false;
      },
      error: (error) => {
        this.toastr.error('Failed to fetch audit logs');
        this.loading = false;
      }
    });
  }

  onSearch() {
    if (!this.searchEndpoint.trim()) {
      this.fetchLogs();
      return;
    }
    this.loading = true;
    this.auditService.getAuditLogsByEndpoint(this.searchEndpoint).subscribe({
      next: (response) => {
        this.logs = response.data?.logs || response.logs || [];
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to search audit logs');
        this.loading = false;
      }
    });
  }

  onPrev() {
    this.pageNumber--;
    this.fetchLogs();
  }

  onNext() {
    this.pageNumber++;
    this.fetchLogs();
  }

  getActionClass(action: string): string {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  formatTimestamp(ts: number): string {
    return new Date(ts * 1000).toLocaleString();
  }
}
