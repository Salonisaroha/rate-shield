import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiConfigurationHeaderComponent } from '../../components/api-configuration-header/api-configuration-header.component';
import { RulesTableComponent } from '../../components/rules-table/rules-table.component';
import { AddOrUpdateRuleComponent } from '../../components/add-or-update-rule/add-or-update-rule.component';
import { RulesService } from '../../services/rules.service';
import { ToastrService } from 'ngx-toastr';
import { Rule } from '../../models/rule.model';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-api-configuration',
  standalone: true,
  imports: [CommonModule, ApiConfigurationHeaderComponent, RulesTableComponent, AddOrUpdateRuleComponent],
  templateUrl: './api-configuration.component.html',
  styleUrls: ['./api-configuration.component.css']
})
export class ApiConfigurationComponent implements OnInit {
  rulesData: Rule[] | undefined;
  searchRuleText = '';
  pageNumber = 1;
  hasNextPage = false;
  isAddNewRuleDialogOpen = false;
  selectedRule: Rule | null = null;
  action: string = 'ADD';

  private isFirstLoad = true;

  // Subject that cancels any in-flight fetch when a new one is triggered
  private fetchTrigger$ = new Subject<number>();

  constructor(private rulesService: RulesService, private toastr: ToastrService) {}

  ngOnInit() {
    // switchMap cancels the previous HTTP request if a new fetch is triggered before it completes
    this.fetchTrigger$.pipe(
      switchMap(page => this.rulesService.getPaginatedRules(page))
    ).subscribe({
      next: (response) => {
        const rules = response.data?.rules ?? [];
        // Deduplicate by endpoint as a safety net
        this.rulesData = rules.filter(
          (rule, index, self) => index === self.findIndex(r => r.endpoint === rule.endpoint)
        );
        this.hasNextPage = response.data?.has_next_page ?? false;
        if (this.rulesData.length === 0 && this.isFirstLoad) {
          this.toastr.info('No rules found. Start by creating one.');
        }
        this.isFirstLoad = false;
      },
      error: (error) => {
        this.toastr.error('Failed to fetch rules: ' + (error.message || error));
      }
    });

    this.fetchRules();
  }

  fetchRules() {
    this.fetchTrigger$.next(this.pageNumber);
  }

  onSearchRules(searchText: string) {
    this.searchRuleText = searchText;
    if (searchText) {
      this.rulesService.searchRulesViaEndpoint(searchText).subscribe({
        next: (response) => {
          this.rulesData = response.data;
        },
        error: (error) => {
          this.toastr.error('Failed to search rules: ' + (error.message || error));
        }
      });
    } else {
      this.fetchRules();
    }
  }

  onOpenAddDialog() {
    this.selectedRule = null;
    this.action = 'ADD';
    this.isAddNewRuleDialogOpen = true;
  }

  onEditRule(rule: Rule) {
    this.selectedRule = rule;
    this.action = 'UPDATE';
    this.isAddNewRuleDialogOpen = true;
  }

  onCloseDialog() {
    this.isAddNewRuleDialogOpen = false;
    this.selectedRule = null;
    this.fetchRules();
  }

  onPageChange(pageNumber: number) {
    this.pageNumber = pageNumber;
    this.fetchRules();
  }
}
