import { Component, EventEmitter, Output } from '@angular/core';
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
  @Output() loginSuccess = new EventEmitter<void>();
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
    this.error = '';

    this.auth.login(this.password).subscribe(result => {
      if (result.success) {
        this.loginSuccess.emit();
      } else {
        this.error = result.message;
        this.loading = false;
      }
    });
  }
}
