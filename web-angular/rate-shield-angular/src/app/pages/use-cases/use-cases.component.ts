import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RulesService } from '../../services/rules.service';
import { ToastrService } from 'ngx-toastr';
import { Rule } from '../../models/rule.model';

export interface UseCase {
  id: string;
  title: string;
  description: string;
  realWorldExample: string;
  icon: string;
  category: string;
  categoryColor: string;
  strategy: 'FIXED WINDOW COUNTER' | 'SLIDING WINDOW COUNTER' | 'TOKEN BUCKET';
  strategyColor: string;
  config: {
    label: string;
    value: string;
  }[];
  ruleConfig: {
    endpoint: string;
    http_method: string;
    strategy: string;
    maxRequests?: number;
    window?: number;
    bucketCapacity?: number;
    tokenAddRate?: number;
    retentionTime?: number;
  };
  testIp: string;
  severity: 'critical' | 'high' | 'medium';
  severityLabel: string;
}

@Component({
  selector: 'app-use-cases',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './use-cases.component.html',
  styleUrls: ['./use-cases.component.css']
})
export class UseCasesComponent {
  @Output() tryInTester = new EventEmitter<{ ip: string; endpoint: string }>();

  selectedCategory = 'All';
  creatingRuleId: string | null = null;  // tracks which card is loading

  constructor(private rulesService: RulesService, private toastr: ToastrService) {}

  categories = ['All', 'Auth & Identity', 'API Protection', 'Communication', 'Payments', 'Content'];

  useCases: UseCase[] = [
    {
      id: 'otp',
      title: 'OTP / SMS Sending',
      description: 'Limit how many OTPs a phone number can request. Prevents SMS bombing and reduces Twilio/SMS costs.',
      realWorldExample: 'Swiggy, Zomato, PhonePe — all limit OTP to 3 per minute per phone number.',
      icon: '📱',
      category: 'Auth & Identity',
      categoryColor: 'bg-purple-100 text-purple-700',
      strategy: 'FIXED WINDOW COUNTER',
      strategyColor: 'bg-blue-100 text-blue-700',
      config: [
        { label: 'Max Requests', value: '3' },
        { label: 'Window', value: '60 seconds' },
        { label: 'Identifier', value: 'Phone number as IP' },
      ],
      ruleConfig: { endpoint: '/api/auth/send-otp', http_method: 'POST', strategy: 'FIXED WINDOW COUNTER', maxRequests: 3, window: 60 },
      testIp: '+91-9876543210',
      severity: 'critical',
      severityLabel: 'Critical'
    },
    {
      id: 'login',
      title: 'Login Brute Force Protection',
      description: 'Block repeated failed login attempts from the same IP. Prevents credential stuffing and dictionary attacks.',
      realWorldExample: 'GitHub locks accounts after 10 failed attempts. Banks block after 3-5.',
      icon: '🔐',
      category: 'Auth & Identity',
      categoryColor: 'bg-purple-100 text-purple-700',
      strategy: 'FIXED WINDOW COUNTER',
      strategyColor: 'bg-blue-100 text-blue-700',
      config: [
        { label: 'Max Requests', value: '5' },
        { label: 'Window', value: '300 seconds (5 min)' },
        { label: 'Identifier', value: 'Client IP address' },
      ],
      ruleConfig: { endpoint: '/api/auth/login', http_method: 'POST', strategy: 'FIXED WINDOW COUNTER', maxRequests: 5, window: 300 },
      testIp: '192.168.1.100',
      severity: 'critical',
      severityLabel: 'Critical'
    },
    {
      id: 'password-reset',
      title: 'Password Reset Emails',
      description: 'Limit password reset email requests per user. Prevents email flooding and abuse of reset flows.',
      realWorldExample: 'Most auth providers allow 2-3 reset emails per hour per account.',
      icon: '📧',
      category: 'Communication',
      categoryColor: 'bg-yellow-100 text-yellow-700',
      strategy: 'FIXED WINDOW COUNTER',
      strategyColor: 'bg-blue-100 text-blue-700',
      config: [
        { label: 'Max Requests', value: '2' },
        { label: 'Window', value: '600 seconds (10 min)' },
        { label: 'Identifier', value: 'User email as IP' },
      ],
      ruleConfig: { endpoint: '/api/auth/forgot-password', http_method: 'POST', strategy: 'FIXED WINDOW COUNTER', maxRequests: 2, window: 600 },
      testIp: 'user@example.com',
      severity: 'high',
      severityLabel: 'High'
    },
    {
      id: 'signup',
      title: 'Signup Spam Prevention',
      description: 'Prevent bots from creating hundreds of fake accounts from the same IP address.',
      realWorldExample: 'Twitter, Reddit limit account creation to 1-3 per IP per hour.',
      icon: '🤖',
      category: 'Auth & Identity',
      categoryColor: 'bg-purple-100 text-purple-700',
      strategy: 'FIXED WINDOW COUNTER',
      strategyColor: 'bg-blue-100 text-blue-700',
      config: [
        { label: 'Max Requests', value: '3' },
        { label: 'Window', value: '3600 seconds (1 hour)' },
        { label: 'Identifier', value: 'Client IP address' },
      ],
      ruleConfig: { endpoint: '/api/auth/signup', http_method: 'POST', strategy: 'FIXED WINDOW COUNTER', maxRequests: 3, window: 3600 },
      testIp: '10.0.0.55',
      severity: 'high',
      severityLabel: 'High'
    },
    {
      id: 'search',
      title: 'Search / Autocomplete',
      description: 'Smooth rate limiting on search APIs. Sliding window prevents burst spikes while allowing consistent usage.',
      realWorldExample: 'Google, Algolia, Elasticsearch — all throttle search to prevent index overload.',
      icon: '🔍',
      category: 'API Protection',
      categoryColor: 'bg-green-100 text-green-700',
      strategy: 'SLIDING WINDOW COUNTER',
      strategyColor: 'bg-green-100 text-green-700',
      config: [
        { label: 'Max Requests', value: '10' },
        { label: 'Window', value: '1 second' },
        { label: 'Identifier', value: 'Client IP address' },
      ],
      ruleConfig: { endpoint: '/api/search', http_method: 'GET', strategy: 'SLIDING WINDOW COUNTER', maxRequests: 10, window: 1 },
      testIp: '172.16.0.1',
      severity: 'medium',
      severityLabel: 'Medium'
    },
    {
      id: 'public-api',
      title: 'Public API Free Tier',
      description: 'Token bucket for API key holders. Allows short bursts but enforces a sustained rate — perfect for freemium APIs.',
      realWorldExample: 'OpenWeatherMap, NewsAPI, RapidAPI all use token bucket for free tier limits.',
      icon: '🔑',
      category: 'API Protection',
      categoryColor: 'bg-green-100 text-green-700',
      strategy: 'TOKEN BUCKET',
      strategyColor: 'bg-purple-100 text-purple-700',
      config: [
        { label: 'Bucket Capacity', value: '100 tokens' },
        { label: 'Token Add Rate', value: '10 per refill' },
        { label: 'Identifier', value: 'API key as IP' },
      ],
      ruleConfig: { endpoint: '/api/v1/data', http_method: 'GET', strategy: 'TOKEN BUCKET', bucketCapacity: 100, tokenAddRate: 10, retentionTime: 3600 },
      testIp: 'api_key_abc123',
      severity: 'medium',
      severityLabel: 'Medium'
    },
    {
      id: 'payment',
      title: 'Payment / Checkout',
      description: 'Prevent payment fraud by limiting checkout attempts per user. Sliding window catches rapid retry attacks.',
      realWorldExample: 'Stripe, Razorpay, PayPal all rate limit payment attempts per card/user.',
      icon: '💳',
      category: 'Payments',
      categoryColor: 'bg-red-100 text-red-700',
      strategy: 'SLIDING WINDOW COUNTER',
      strategyColor: 'bg-green-100 text-green-700',
      config: [
        { label: 'Max Requests', value: '3' },
        { label: 'Window', value: '10 seconds' },
        { label: 'Identifier', value: 'User ID as IP' },
      ],
      ruleConfig: { endpoint: '/api/payments/checkout', http_method: 'POST', strategy: 'SLIDING WINDOW COUNTER', maxRequests: 3, window: 10 },
      testIp: 'user_id_789',
      severity: 'critical',
      severityLabel: 'Critical'
    },
    {
      id: 'file-upload',
      title: 'File Upload Throttle',
      description: 'Token bucket for file uploads. Allows a burst of uploads then slows down — prevents storage abuse.',
      realWorldExample: 'Google Drive, Dropbox, S3 presigned URLs all throttle upload frequency.',
      icon: '📁',
      category: 'Content',
      categoryColor: 'bg-orange-100 text-orange-700',
      strategy: 'TOKEN BUCKET',
      strategyColor: 'bg-purple-100 text-purple-700',
      config: [
        { label: 'Bucket Capacity', value: '5 tokens' },
        { label: 'Token Add Rate', value: '1 per refill' },
        { label: 'Identifier', value: 'User ID as IP' },
      ],
      ruleConfig: { endpoint: '/api/files/upload', http_method: 'POST', strategy: 'TOKEN BUCKET', bucketCapacity: 5, tokenAddRate: 1, retentionTime: 300 },
      testIp: 'user_id_456',
      severity: 'medium',
      severityLabel: 'Medium'
    },
    {
      id: 'comment',
      title: 'Comment / Post Spam',
      description: 'Prevent users from flooding comment sections or posting too rapidly. Keeps communities clean.',
      realWorldExample: 'Reddit, YouTube, Twitter all limit post frequency per account.',
      icon: '💬',
      category: 'Content',
      categoryColor: 'bg-orange-100 text-orange-700',
      strategy: 'FIXED WINDOW COUNTER',
      strategyColor: 'bg-blue-100 text-blue-700',
      config: [
        { label: 'Max Requests', value: '5' },
        { label: 'Window', value: '60 seconds' },
        { label: 'Identifier', value: 'User ID as IP' },
      ],
      ruleConfig: { endpoint: '/api/posts/comment', http_method: 'POST', strategy: 'FIXED WINDOW COUNTER', maxRequests: 5, window: 60 },
      testIp: 'user_id_321',
      severity: 'medium',
      severityLabel: 'Medium'
    },
    {
      id: 'admin',
      title: 'Admin Panel Actions',
      description: 'Rate limit destructive admin operations like bulk deletes, exports, or config changes.',
      realWorldExample: 'AWS Console, GCP, Vercel all throttle bulk/destructive admin API calls.',
      icon: '⚙️',
      category: 'API Protection',
      categoryColor: 'bg-green-100 text-green-700',
      strategy: 'FIXED WINDOW COUNTER',
      strategyColor: 'bg-blue-100 text-blue-700',
      config: [
        { label: 'Max Requests', value: '10' },
        { label: 'Window', value: '60 seconds' },
        { label: 'Identifier', value: 'Admin user ID as IP' },
      ],
      ruleConfig: { endpoint: '/api/admin/bulk-delete', http_method: 'POST', strategy: 'FIXED WINDOW COUNTER', maxRequests: 10, window: 60 },
      testIp: 'admin_user_001',
      severity: 'high',
      severityLabel: 'High'
    },
  ];

  get filteredUseCases(): UseCase[] {
    if (this.selectedCategory === 'All') return this.useCases;
    return this.useCases.filter(u => u.category === this.selectedCategory);
  }

  get criticalCount(): number { return this.useCases.filter(u => u.severity === 'critical').length; }
  get highCount(): number { return this.useCases.filter(u => u.severity === 'high').length; }
  get mediumCount(): number { return this.useCases.filter(u => u.severity === 'medium').length; }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border border-red-200';
      case 'high':     return 'bg-orange-100 text-orange-700 border border-orange-200';
      default:         return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    }
  }

  onTryIt(useCase: UseCase) {
    this.tryInTester.emit({ ip: useCase.testIp, endpoint: useCase.ruleConfig.endpoint });
  }

  onCreateRule(useCase: UseCase) {
    this.creatingRuleId = useCase.id;

    const rule: Rule = {
      endpoint: useCase.ruleConfig.endpoint,
      http_method: useCase.ruleConfig.http_method,
      strategy: useCase.ruleConfig.strategy,
      allow_on_error: false,
      token_bucket_rule: useCase.ruleConfig.strategy === 'TOKEN BUCKET' ? {
        bucket_capacity: useCase.ruleConfig.bucketCapacity!,
        token_add_rate: useCase.ruleConfig.tokenAddRate!,
        retention_time: useCase.ruleConfig.retentionTime!
      } : null,
      fixed_window_counter_rule: useCase.ruleConfig.strategy === 'FIXED WINDOW COUNTER' ? {
        max_requests: useCase.ruleConfig.maxRequests!,
        window: useCase.ruleConfig.window!
      } : null,
      sliding_window_counter_rule: useCase.ruleConfig.strategy === 'SLIDING WINDOW COUNTER' ? {
        max_requests: useCase.ruleConfig.maxRequests!,
        window: useCase.ruleConfig.window!
      } : null,
    };

    this.rulesService.createNewRule(rule).subscribe({
      next: () => {
        this.creatingRuleId = null;
        this.toastr.success(`Rule created for ${useCase.ruleConfig.endpoint}`);
      },
      error: (err: any) => {
        this.creatingRuleId = null;
        if (err?.status === 401) {
          this.toastr.error('Session expired. Please log in again.');
        } else {
          this.toastr.error(`Failed to create rule — ${err?.error?.message || 'backend may be offline'}`);
        }
      }
    });
  }
}
