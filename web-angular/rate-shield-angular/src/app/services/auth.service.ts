import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

const AUTH_KEY = 'rs_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {

  isLoggedIn(): boolean {
    return localStorage.getItem(AUTH_KEY) === 'true';
  }

  login(password: string): boolean {
    if (password === environment.dashboardPassword) {
      localStorage.setItem(AUTH_KEY, 'true');
      return true;
    }
    return false;
  }

  logout(): void {
    localStorage.removeItem(AUTH_KEY);
  }
}
