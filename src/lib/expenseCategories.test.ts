import { describe, expect, it } from 'vitest';
import { Category } from '../types/database';
import { getExpenseCategories } from './expenseCategories';

const categories: Category[] = [
  { id: 'expense-school', household_id: 'synthetic', name: 'School', icon_slug: 'education', category_type: 'expense', monthly_budget_limit: 5000, created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'income-salary', household_id: 'synthetic', name: 'Salary', icon_slug: 'briefcase', category_type: 'income', monthly_budget_limit: 0, created_at: '2026-10-01T00:00:00.000Z' },
];

describe('expense category options', () => {
  it('includes expense types and excludes income types', () => {
    expect(getExpenseCategories(categories).map(category => category.id)).toEqual(['expense-school']);
  });
});
