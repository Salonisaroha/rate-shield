import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ContentAreaComponent } from './components/content-area/content-area.component';
import { LoginComponent } from './pages/login/login.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, ContentAreaComponent, LoginComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  selectedPage = 'DASHBOARD';
  authChecked = false;
  verifyState: 'idle' | 'verifying' | 'success' | 'error' = 'idle';
  verifyMessage = '';

  constructor(public auth: AuthService) {}

  ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    const reason = params.get('reason');

    if (verified === 'true') {
      window.history.replaceState({}, '', '/');
      this.verifyState = 'success';
      setTimeout(() => { this.verifyState = 'idle'; this.authChecked = true; }, 2500);
      return;
    }

    if (verified === 'false') {
      window.history.replaceState({}, '', '/');
      this.verifyState = 'error';
      this.verifyMessage = reason === 'expired'
        ? 'Verification link has expired. Please request a new one.'
        : 'Verification failed. Please try again.';
      setTimeout(() => { this.verifyState = 'idle'; this.authChecked = true; }, 3500);
      return;
    }

    this.auth.validateStoredToken().subscribe(() => {
      this.authChecked = true;
    });
  }

  onSelectPage(page: string) {
    this.selectedPage = page;
  }
}
