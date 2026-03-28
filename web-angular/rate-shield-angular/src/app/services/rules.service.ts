import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Rule, PaginatedRulesResponse, GetAllRuleResponse } from '../models/rule.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RulesService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAllRules(): Observable<GetAllRuleResponse> {
    return this.http.get<GetAllRuleResponse>(`${this.baseUrl}/rule/list`);
  }

  getPaginatedRules(pageNumber: number): Observable<PaginatedRulesResponse> {
    return this.http.get<PaginatedRulesResponse>(`${this.baseUrl}/rule/list?page=${pageNumber}&items=10`);
  }

  searchRulesViaEndpoint(searchText: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/rule/search?endpoint=${searchText}`);
  }

  createNewRule(rule: Rule): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(`${this.baseUrl}/rule/add`, JSON.stringify(rule), { headers });
  }

  deleteRule(ruleKey: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(`${this.baseUrl}/rule/delete`, JSON.stringify({ rule_key: ruleKey }), { headers });
  }
}
