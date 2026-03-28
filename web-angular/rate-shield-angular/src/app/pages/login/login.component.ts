import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  password = '';
  error = '';
  loading = false;
  focused = false;
  showPassword = false;

  constructor(private auth: AuthService) {}

  onLogin() {
    if (!this.password.trim()) {
      this.error = 'Password is required.';
      return;
    }
    this.loading = true;
    setTimeout(() => {
      const success = this.auth.login(this.password);
      if (!success) {
        this.error = 'Incorrect password. Please try again.';
      }
      this.loading = false;
    }, 400);
  }
}
