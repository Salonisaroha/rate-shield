import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'rs_token';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private http: HttpClient) {}

  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
   
  }
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }
  validateStoredToken(): Observable<boolean> {
    const token = this.getToken();
    if (!token) return of(false);

    return this.http.post<any>(`${environment.apiUrl}/auth/validate`, { token }).pipe(
      map(res => res.data === 'valid'),
      tap(valid => {
        if (!valid) localStorage.removeItem(TOKEN_KEY);
      }),
      catchError(() => {
        localStorage.removeItem(TOKEN_KEY);
        return of(false);
      })
    );
  }
  login(password: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, { password }).pipe(

      tap(res => {
        if (res.data?.token) {
          localStorage.setItem(TOKEN_KEY, res.data.token);
        }
      }),
      map(res => ({ success: !!res.data?.token, message: '' })),

      catchError(err => {
        const message = err.error?.message || 'Incorrect password. Please try again.';
        return of({ success: false, message });
      })
    );
  }
  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
  }
  logout(): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${environment.apiUrl}/auth/logout`, { token }).subscribe();
    }
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }
}
