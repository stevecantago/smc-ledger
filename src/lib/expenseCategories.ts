import { Category } from '../types/database';

export function getExpenseCategories(categories: Category[]): Category[] {
  return categories.filter(category => category.category_type === 'expense');
}
