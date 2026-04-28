import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Authorization': `Bearer ${this.auth.getToken()}` });
  }

  getAuditLogs(page: number, items: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/audit/logs?page=${page}&items=${items}`, { headers: this.authHeaders() });
  }

  getAuditLogsByEndpoint(endpoint: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/audit/logs?endpoint=${encodeURIComponent(endpoint)}`, { headers: this.authHeaders() });
  }

  getAuditLogsByActor(actor: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/audit/logs?actor=${encodeURIComponent(actor)}`, { headers: this.authHeaders() });
  }
}
