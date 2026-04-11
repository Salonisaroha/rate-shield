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

  constructor(public auth: AuthService) {}

  ngOnInit() {
    this.auth.clearSession();
    this.authChecked = true;
  }

  onLoginSuccess() {
    this.authChecked = false;
    setTimeout(() => this.authChecked = true, 0);
  }

  onSelectPage(page: string) {
    this.selectedPage = page;
  }
}
