import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Rule } from '../../models/rule.model';

@Component({
  selector: 'app-api-configuration-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-configuration-header.component.html',
  styleUrls: ['./api-configuration-header.component.css']
})
export class ApiConfigurationHeaderComponent {
  @Output() openAddDialog = new EventEmitter<void>();
  @Output() searchRules = new EventEmitter<string>();

  searchedText = '';

  onSearch() {
    this.searchRules.emit(this.searchedText);
  }

  onAddNew() {
    this.openAddDialog.emit();
  }
}
