import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaginatedAuditLogs, AuditLog } from '../models/audit.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAuditLogs(page: number, items: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/audit/logs?page=${page}&items=${items}`);
  }

  getAuditLogsByEndpoint(endpoint: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/audit/logs?endpoint=${endpoint}`);
  }
}
