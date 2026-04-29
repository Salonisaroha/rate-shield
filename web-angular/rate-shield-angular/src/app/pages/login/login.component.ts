import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

type Mode = 'login' | 'register';
type Screen = 'form' | 'otp';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('particleCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  mode: Mode = 'login';
  screen: Screen = 'form';

  email = '';
  password = '';
  otp = '';
  error = '';
  info = '';
  loading = false;
  otpLoading = false;
  resendLoading = false;
  showPassword = false;
  focused: { [k: string]: boolean } = {};

  strengthScore = 0;
  strengthLabel = '';
  strengthColor = '';

  totalRules = 0;
  displayedRules = 0;
  private countInterval: any;
  private animFrame: any;
  private particles: any[] = [];

  constructor(private auth: AuthService, private http: HttpClient) {}

  ngOnInit() {
    this.loadStats();
  }

  ngAfterViewInit() {
    this.initParticles();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animFrame);
    clearInterval(this.countInterval);
  }

  onPasswordChange() {
    const p = this.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    this.strengthScore = score;
    if (score <= 1) { this.strengthLabel = 'Weak'; this.strengthColor = '#EF4444'; }
    else if (score <= 3) { this.strengthLabel = 'Fair'; this.strengthColor = '#F59E0B'; }
    else if (score === 4) { this.strengthLabel = 'Good'; this.strengthColor = '#3B82F6'; }
    else { this.strengthLabel = 'Strong'; this.strengthColor = '#10B981'; }
  }

  get strengthWidth(): string {
    return `${(this.strengthScore / 5) * 100}%`;
  }

  loadStats() {
    this.http.get<any>(`${environment.apiUrl}/stats`).subscribe({
      next: res => { this.totalRules = res.data?.total_rules ?? 0; this.animateCount(); },
      error: () => { this.totalRules = 0; }
    });
  }

  animateCount() {
    const steps = 40;
    const increment = this.totalRules / steps;
    let current = 0;
    this.countInterval = setInterval(() => {
      current += increment;
      if (current >= this.totalRules) { this.displayedRules = this.totalRules; clearInterval(this.countInterval); }
      else { this.displayedRules = Math.floor(current); }
    }, 1200 / steps);
  }

  initParticles() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 55; i++) {
      this.particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 2 + 1, dx: (Math.random() - 0.5) * 0.4, dy: (Math.random() - 0.5) * 0.4, alpha: Math.random() * 0.4 + 0.1 });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of this.particles) {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${p.alpha})`; ctx.fill();
      }
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const dx = this.particles[i].x - this.particles[j].x;
          const dy = this.particles[i].y - this.particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath(); ctx.moveTo(this.particles[i].x, this.particles[i].y);
            ctx.lineTo(this.particles[j].x, this.particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${0.12 * (1 - dist / 120)})`; ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
      }
      this.animFrame = requestAnimationFrame(draw);
    };
    draw();
  }

  switchMode(m: Mode) {
    this.mode = m;
    this.email = ''; this.password = ''; this.otp = '';
    this.error = ''; this.info = '';
    this.screen = 'form';
    this.strengthScore = 0; this.strengthLabel = '';
  }

  // Step 1: register → send OTP, or login directly
  onSubmit() {
    if (!this.email.trim() || !this.password.trim()) {
      this.error = 'Email and password are required.';
      return;
    }
    this.loading = true;
    this.error = '';

    if (this.mode === 'register') {
      this.auth.register(this.email.trim(), this.password).subscribe({
        next: res => {
          this.loading = false;
          if (res.success) {
            this.screen = 'otp';
          } else {
            this.error = res.message || 'Registration failed. Please try again.';
          }
        },
        error: () => {
          this.loading = false;
          this.error = 'Unable to connect to server. Please try again.';
        }
      });
    } else {
      this.auth.login(this.email.trim(), this.password).subscribe({
        next: res => {
          if (res.success) {
            window.location.reload();
          } else if (res.needsVerification) {
            this.loading = false;
            this.auth.resendOtp(this.email.trim()).subscribe();
            this.screen = 'otp';
          } else {
            this.error = res.message || 'Invalid email or password.';
            this.loading = false;
          }
        },
        error: () => {
          this.loading = false;
          this.error = 'Unable to connect to server. Please try again.';
        }
      });
    }
  }

  // Step 2: submit OTP
  onVerifyOtp() {
    if (this.otp.trim().length !== 6) {
      this.error = 'Please enter the 6-digit OTP.';
      return;
    }
    this.otpLoading = true;
    this.error = '';
    this.auth.verifyOtp(this.email.trim(), this.otp.trim()).subscribe(res => {
      this.otpLoading = false;
      if (res.success) {
        window.location.reload();
      } else {
        this.error = res.message;
      }
    });
  }

  onResendOtp() {
    this.resendLoading = true;
    this.info = '';
    this.error = '';
    this.auth.resendOtp(this.email.trim()).subscribe(res => {
      this.resendLoading = false;
      if (res.success) {
        this.info = 'A new OTP has been sent to your email.';
        this.otp = '';
      } else {
        this.error = res.message;
      }
    });
  }

  onGoogleLogin() {
    this.auth.loginWithGoogle();
  }
}
