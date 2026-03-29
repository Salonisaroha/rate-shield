import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

// The key used to store the session token in localStorage
// localStorage is the browser's built-in key-value storage
const TOKEN_KEY = 'rs_token';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private http: HttpClient) {}

  // ─────────────────────────────────────────────
  // isLoggedIn()
  // Checks if a session token exists in localStorage.
  // Returns true if token exists, false if not.
  // Used by app.component.html to decide whether to show login or dashboard.
  // ─────────────────────────────────────────────
  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
    // !! converts the value to boolean:
    // null → false (not logged in)
    // "abc123..." → true (logged in)
  }

  // ─────────────────────────────────────────────
  // getToken()
  // Returns the session token stored in localStorage.
  // Returns null if no token exists.
  // ─────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // ─────────────────────────────────────────────
  // validateStoredToken()
  // Called once every time the Angular app loads (in app.component.ts ngOnInit).
  // Sends the stored token to the backend to check if it is still valid in Redis.
  //
  // Why is this needed?
  // The token in localStorage could be expired (24 hours passed) or
  // manually deleted from Redis (logout from another device).
  // This ensures the frontend always reflects the real server state.
  //
  // Flow:
  //   1. Read token from localStorage
  //   2. If no token → return false immediately (not logged in)
  //   3. POST /auth/validate with the token
  //   4. Backend checks Redis → returns "valid" or 401
  //   5. If valid → return true (stay logged in)
  //   6. If invalid → remove token from localStorage → return false (show login)
  // ─────────────────────────────────────────────
  validateStoredToken(): Observable<boolean> {
    const token = this.getToken();

    // No token in localStorage — user is not logged in
    if (!token) return of(false);

    // Send token to backend for validation
    return this.http.post<any>(`${environment.apiUrl}/auth/validate`, { token }).pipe(

      // map transforms the response into a boolean
      map(res => res.data === 'valid'),

      // tap runs a side effect without changing the value
      // If token is invalid, remove it from localStorage
      tap(valid => {
        if (!valid) localStorage.removeItem(TOKEN_KEY);
      }),

      // catchError handles network errors (e.g. backend is offline)
      // In that case, keep the token and assume logged in
      // so the user is not logged out just because the server is temporarily down
      catchError(() => {
        return of(true); // keep session alive if backend is unreachable
      })
    );
  }

  // ─────────────────────────────────────────────
  // login(password)
  // Sends the password to the backend for verification.
  //
  // Flow:
  //   1. POST /auth/login with { password }
  //   2. Backend fetches bcrypt hash from Redis
  //   3. Backend compares password with hash using bcrypt
  //   4. If match → backend generates a random 64-char token
  //   5. Backend stores token in Redis with 24h expiry
  //   6. Backend returns { token: "abc123..." }
  //   7. Frontend stores token in localStorage as "rs_token"
  //   8. Returns { success: true } to the login component
  //   9. Login component reloads the page → dashboard shows
  //
  // If password is wrong:
  //   Backend returns 401 → catchError returns { success: false, message: "Incorrect password" }
  //   Login component shows the error message to the user
  // ─────────────────────────────────────────────
  login(password: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<any>(`${environment.apiUrl}/auth/login`, { password }).pipe(

      // tap: if login succeeded, save the token to localStorage
      tap(res => {
        if (res.data?.token) {
          localStorage.setItem(TOKEN_KEY, res.data.token);
        }
      }),

      // map: convert the response to a simple { success, message } object
      map(res => ({ success: !!res.data?.token, message: '' })),

      // catchError: handle wrong password or network error
      catchError(err => {
        const message = err.error?.message || 'Incorrect password. Please try again.';
        return of({ success: false, message });
      })
    );
  }

  // ─────────────────────────────────────────────
  // logout()
  // Logs the user out by:
  //   1. Sending the token to the backend → backend deletes it from Redis immediately
  //   2. Removing the token from localStorage
  //
  // After this, the token is invalid on both the server and the browser.
  // The app.component.html *ngIf re-evaluates and shows the login page.
  // ─────────────────────────────────────────────
  logout(): void {
    const token = this.getToken();

    if (token) {
      // Tell the backend to delete this session from Redis
      // .subscribe() is needed to actually trigger the HTTP call
      this.http.post(`${environment.apiUrl}/auth/logout`, { token }).subscribe();
    }

    // Remove the token from the browser's localStorage
    localStorage.removeItem(TOKEN_KEY);

    // Reload the page so the login screen appears
    window.location.reload();
  }

  // ─────────────────────────────────────────────
  // setupPassword(password)
  // One-time setup — stores the hashed password in Redis.
  // Only works if no password has been set yet.
  // Call this once via Postman: POST /auth/setup { "password": "yourpassword" }
  // ─────────────────────────────────────────────
  setupPassword(password: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/setup`, { password });
  }
}
