import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Rule, PaginatedRulesResponse, GetAllRuleResponse } from '../models/rule.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RulesService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.auth.getToken()}`
    });
  }

  getAllRules(): Observable<GetAllRuleResponse> {
    return this.http.get<GetAllRuleResponse>(`${this.baseUrl}/rule/list`, { headers: this.authHeaders() });
  }

  getPaginatedRules(pageNumber: number): Observable<PaginatedRulesResponse> {
    return this.http.get<PaginatedRulesResponse>(`${this.baseUrl}/rule/list?page=${pageNumber}&items=10`, { headers: this.authHeaders() });
  }

  searchRulesViaEndpoint(searchText: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/rule/search?endpoint=${searchText}`, { headers: this.authHeaders() });
  }

  createNewRule(rule: Rule): Observable<any> {
    return this.http.post(`${this.baseUrl}/rule/add`, JSON.stringify(rule), { headers: this.authHeaders() });
  }

  deleteRule(ruleKey: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/rule/delete`, JSON.stringify({ rule_key: ruleKey }), { headers: this.authHeaders() });
  }
}
