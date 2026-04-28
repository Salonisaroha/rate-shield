import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'rs_token';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private http: HttpClient) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  validateStoredToken(): Observable<boolean> {
    const token = this.getToken();
    if (!token) return of(false);
    if (token.split('.').length !== 3) {
      localStorage.removeItem(TOKEN_KEY);
      return of(false);
    }
    return this.http.post<any>(`${environment.apiUrl}/auth/validate`, { token }).pipe(
      map(res => res.data === 'valid'),
      tap(valid => { if (!valid) localStorage.removeItem(TOKEN_KEY); }),
      catchError(() => { localStorage.removeItem(TOKEN_KEY); return of(false); })
    );
  }

  register(email: string, password: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${environment.apiUrl}/auth/register`, { email, password }).pipe(
      map(() => ({ success: true, message: '' })),
      catchError(err => {
        const msg = err.error?.message || (err.status === 429 ? 'Too many attempts. Please wait before trying again.' : 'Registration failed');
        return of({ success: false, message: msg });
      })
    );
  }

  verifyOtp(email: string, otp: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${environment.apiUrl}/auth/verify-otp`, { email, otp }).pipe(
      tap(res => { if (res.data?.token) localStorage.setItem(TOKEN_KEY, res.data.token); }),
      map(res => ({ success: !!res.data?.token, message: '' })),
      catchError(err => {
        const msg = err.error?.message || (err.status === 429 ? 'Too many attempts. Please wait before trying again.' : 'Invalid OTP');
        return of({ success: false, message: msg });
      })
    );
  }

  resendOtp(email: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${environment.apiUrl}/auth/resend-otp`, { email }).pipe(
      map(() => ({ success: true, message: 'A new OTP has been sent to your email.' })),
      catchError(err => {
        const msg = err.error?.message || (err.status === 429 ? 'Too many attempts. Please wait before trying again.' : 'Failed to resend OTP');
        return of({ success: false, message: msg });
      })
    );
  }

  login(email: string, password: string): Observable<{ success: boolean; message: string; needsVerification: boolean }> {
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => { if (res.data?.token) localStorage.setItem(TOKEN_KEY, res.data.token); }),
      map(res => ({ success: !!res.data?.token, message: '', needsVerification: false })),
      catchError(err => {
        if (err.status === 429) {
          const msg = err.error?.message || 'Too many attempts. Please wait before trying again.';
          return of({ success: false, message: msg, needsVerification: false });
        }
        const isUnverified = err.error?.message === 'email_not_verified';
        return of({
          success: false,
          message: isUnverified ? 'email_not_verified' : (err.error?.message || 'Invalid email or password'),
          needsVerification: isUnverified
        });
      })
    );
  }

  loginWithGoogle(): void {
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  logout(): void {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe();
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }
}
