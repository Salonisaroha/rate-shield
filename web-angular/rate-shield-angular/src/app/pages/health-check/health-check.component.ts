import { Component, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { interval, Subscription } from 'rxjs';

interface TestResult {
  status: number;
  limit: number | null;
  remaining: number | null;
  timestamp: Date;
  blocked: boolean;
}

@Component({
  selector: 'app-health-check',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './health-check.component.html',
  styleUrls: ['./health-check.component.css']
})
export class HealthCheckComponent implements OnDestroy, OnChanges {
  @Input() prefillIp: string = '';
  @Input() prefillEndpoint: string = '';

  ip = '192.168.1.1';
  endpoint = '/api/v1/test';

  ngOnChanges(changes: SimpleChanges) {
    const newIp = changes['prefillIp']?.currentValue;
    const newEndpoint = changes['prefillEndpoint']?.currentValue;
    if (newIp) {
      // Strip the timestamp suffix added to force change detection (format: "ip|timestamp")
      this.ip = newIp.includes('|') ? newIp.split('|')[0] : newIp;
      this.reset();
    }
    if (newEndpoint) {
      this.endpoint = newEndpoint;
    }
  }

  limit: number | null = null;
  remaining: number | null = null;
  lastStatus: number | null = null;
  isBlocked = false;
  testing = false;
  simulating = false;
  noRuleFound = false;

  history: TestResult[] = [];
  private simSub?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnDestroy() {
    this.simSub?.unsubscribe();
  }

  test() {
    if (!this.ip.trim() || !this.endpoint.trim()) return;
    this.testing = true;

    const headers = new HttpHeaders({
      'ip': this.ip.trim(),
      'endpoint': this.endpoint.trim()
    });

    this.http.get(`${environment.apiUrl}/check-limit`, { headers, observe: 'response' }).subscribe({
      next: (res: HttpResponse<any>) => this.handleResponse(res.status, res.headers),
      error: (err) => this.handleResponse(err.status, err.headers ?? null)
    });
  }

  private handleResponse(status: number, headers: any) {
    this.testing = false;
    this.lastStatus = status;
    this.isBlocked = status === 429;

    const limitVal = headers?.get('rate-limit');
    const remainingVal = headers?.get('rate-limit-remaining');

    if (status === 200) {
      if (limitVal !== null && limitVal !== undefined) this.limit = +limitVal;
      if (remainingVal !== null && remainingVal !== undefined) this.remaining = +remainingVal;
      // If no headers returned, rule was not found — limit stays null
      this.noRuleFound = (limitVal === null || limitVal === undefined);
    } else if (status === 429) {
      this.remaining = 0;
      this.noRuleFound = false;
    }

    this.history.unshift({
      status,
      limit: this.limit,
      remaining: this.remaining,
      timestamp: new Date(),
      blocked: status === 429
    });

    if (this.history.length > 20) this.history.pop();
  }

  toggleSimulate() {
    if (this.simulating) {
      this.simSub?.unsubscribe();
      this.simulating = false;
    } else {
      this.simulating = true;
      this.test();
      this.simSub = interval(800).subscribe(() => this.test());
    }
  }

  reset() {
    this.simSub?.unsubscribe();
    this.simulating = false;
    this.limit = null;
    this.remaining = null;
    this.lastStatus = null;
    this.isBlocked = false;
    this.noRuleFound = false;
    this.history = [];
  }

  get capacityPercent(): number {
    if (this.limit === null || this.limit === 0) return 100;
    if (this.remaining === null) return 100;
    return Math.round((this.remaining / this.limit) * 100);
  }

  get barColor(): string {
    if (this.isBlocked) return 'bg-red-500';
    if (this.capacityPercent <= 20) return 'bg-red-400';
    if (this.capacityPercent <= 50) return 'bg-yellow-400';
    return 'bg-green-500';
  }

  get statusLabel(): string {
    if (this.lastStatus === null) return 'Not tested';
    if (this.lastStatus === 429) return 'Rate Limited';
    if (this.lastStatus === 200 && this.noRuleFound) return 'No Rule Found';
    if (this.lastStatus === 200) return 'Allowed';
    return 'Error';
  }

  get statusClass(): string {
    if (this.lastStatus === 200 && !this.noRuleFound) return 'bg-green-100 text-green-700';
    if (this.lastStatus === 429) return 'bg-red-100 text-red-700';
    if (this.noRuleFound) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-500';
  }
}
