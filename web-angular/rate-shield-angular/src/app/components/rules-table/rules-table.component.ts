import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Rule } from '../../models/rule.model';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-rules-table',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './rules-table.component.html',
  styleUrls: ['./rules-table.component.css']
})
export class RulesTableComponent {
  @Input() rulesData: Rule[] | undefined;
  @Input() currentPageNumber: number = 1;
  @Input() hasNextPage: boolean = false;
  @Output() editRule = new EventEmitter<Rule>();
  @Output() pageChange = new EventEmitter<number>();

  onEdit(rule: Rule) {
    this.editRule.emit(rule);
  }

  onPrev() {
    this.pageChange.emit(this.currentPageNumber - 1);
  }

  onNext() {
    this.pageChange.emit(this.currentPageNumber + 1);
  }

  shouldShowPrev(): boolean {
    return this.currentPageNumber > 1;
  }

  shouldShowNext(): boolean {
    return this.hasNextPage;
  }

  getMethodClass(method: string): string {
    switch (method) {
      case 'GET': return 'bg-emerald-50 text-emerald-700';
      case 'POST': return 'bg-blue-50 text-blue-700';
      case 'DELETE': return 'bg-red-50 text-red-600';
      case 'PUT': return 'bg-amber-50 text-amber-700';
      case 'PATCH': return 'bg-orange-50 text-orange-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  }

  getStrategyClass(strategy: string): string {
    switch (strategy) {
      case 'TOKEN BUCKET': return 'bg-violet-50 text-violet-700';
      case 'FIXED WINDOW COUNTER': return 'bg-blue-50 text-blue-700';
      case 'SLIDING WINDOW COUNTER': return 'bg-emerald-50 text-emerald-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  }
}
