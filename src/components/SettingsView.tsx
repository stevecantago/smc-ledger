'use client';

import React, { FormEvent, useState } from 'react';
import { Check, CircleArrowDown, CircleArrowUp, List, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { Category, CategoryType } from '../types/database';
import { AVAILABLE_ICONS, CategoryIcon } from './CategoryIcon';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

const listMeta: Record<CategoryType, { title: string; placeholder: string; icon: typeof CircleArrowUp }> = {
  income: { title: 'Income Categories', placeholder: 'New Income…', icon: CircleArrowUp },
  expense: { title: 'Expense Categories', placeholder: 'New Expense…', icon: CircleArrowDown },
};

export const SettingsView: React.FC = () => {
  const { categories, hasPermission, addCategory, updateCategory, deleteCategory } = useHousehold();
  const canManageCategories = hasPermission('manage_categories');
  const [newName, setNewName] = useState<Record<CategoryType, string>>({ income: '', expense: '' });
  const [newIcon, setNewIcon] = useState<Record<CategoryType, string>>({ income: 'trending-up', expense: 'shopping-cart' });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [message, setMessage] = useState('');

  const handleAdd = (event: FormEvent, categoryType: CategoryType) => {
    event.preventDefault();
    const name = newName[categoryType].trim();
    if (!name) return;
    const result = addCategory({
      name,
      icon_slug: newIcon[categoryType],
      category_type: categoryType,
      monthly_budget_limit: 0,
    });
    if (!result.success) {
      setMessage(result.error || `Could not add this ${categoryType} category.`);
      return;
    }
    setNewName(previous => ({ ...previous, [categoryType]: '' }));
    setMessage(`${name} added to ${listMeta[categoryType].title}.`);
  };

  const beginEdit = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditIcon(category.icon_slug);
    setMessage('');
  };

  const handleEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategory) return;
    const name = editName.trim();
    if (!name) return;
    const result = updateCategory(editingCategory.id, { name, icon_slug: editIcon });
    if (!result.success) {
      setMessage(result.error || 'Could not update this category.');
      return;
    }
    setEditingCategory(null);
    setMessage(`${name} updated.`);
  };

  const handleDelete = (category: Category) => {
    const label = category.category_type === 'income' ? 'income' : 'expense';
    if (!window.confirm(`Delete ${label} category “${category.name}”?`)) return;
    const result = deleteCategory(category.id);
    setMessage(result.success ? `${category.name} deleted.` : result.error || 'Could not delete this category.');
  };

  const renderCategoryList = (categoryType: CategoryType) => {
    const { title, placeholder, icon: DirectionIcon } = listMeta[categoryType];
    const list = categories.filter(category => category.category_type === categoryType);
    const isIncome = categoryType === 'income';

    return (
      <section key={categoryType} aria-labelledby={`${categoryType}-categories-heading`} className="overflow-hidden rounded-2xl border border-brand-line bg-brand-paper shadow-[var(--fam-shadow)]">
        <div className="flex flex-col gap-3 border-b border-brand-line bg-brand-canvas px-4 py-4 sm:px-5">
          <div>
            <h3 id={`${categoryType}-categories-heading`} className="flex items-center gap-2 font-semibold text-brand-ink">
              <DirectionIcon className={`h-4 w-4 ${isIncome ? 'text-[#168B63]' : 'text-brand-orange'}`} aria-hidden="true" />
              {title}
            </h3>
            <p className="mt-1 text-xs text-brand-muted">{isIncome ? 'Used to label income entries.' : 'Used by envelope budgets and expense entries.'}</p>
          </div>
          {canManageCategories && (
            <form onSubmit={event => handleAdd(event, categoryType)} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor={`new-${categoryType}-category`} className="sr-only">New {categoryType} category</label>
              <input
                id={`new-${categoryType}-category`}
                value={newName[categoryType]}
                onChange={event => setNewName(previous => ({ ...previous, [categoryType]: event.target.value }))}
                placeholder={placeholder}
                maxLength={100}
                required
                className="min-w-0 flex-1 rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
              />
              <label htmlFor={`new-${categoryType}-icon`} className="sr-only">{categoryType} category icon</label>
              <select id={`new-${categoryType}-icon`} value={newIcon[categoryType]} onChange={event => setNewIcon(previous => ({ ...previous, [categoryType]: event.target.value }))} className="rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                {AVAILABLE_ICONS.map(icon => <option key={icon.slug} value={icon.slug}>{icon.label}</option>)}
              </select>
              <Button type="submit" tone="primary" size="sm" aria-label={`Add ${categoryType} category`} className="shrink-0">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add
              </Button>
            </form>
          )}
        </div>

        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[340px] border-collapse text-left" aria-label={title}>
            <thead className="sticky top-0 bg-white text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Category</th>
                {canManageCategories && <th scope="col" className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {list.map(category => (
                <tr key={category.id} className="bg-white hover:bg-brand-canvas">
                  <th scope="row" className="px-4 py-2.5 font-medium text-brand-ink">
                    <span className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isIncome ? 'bg-brand-mint' : 'bg-brand-sky'}`}>
                        <CategoryIcon slug={category.icon_slug} className="h-4 w-4" />
                      </span>
                      <span className="truncate">{category.name}</span>
                    </span>
                  </th>
                  {canManageCategories && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button type="button" onClick={() => beginEdit(category)} aria-label={`Edit ${category.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-sky hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => handleDelete(category)} aria-label={`Delete ${category.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-[#FBEEEE] hover:text-[#A43838] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={canManageCategories ? 2 : 1} className="px-4 py-10 text-center text-sm text-brand-muted">No {isIncome ? 'income' : 'expense'} categories yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <div className="famledger-view mx-auto max-w-6xl space-y-6 pb-28 md:pb-6">
      <header className="rounded-2xl border border-brand-line bg-brand-paper p-5 shadow-[var(--fam-shadow)] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-sky text-brand-ink">
            <Settings className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-brand-ink">Settings</h1>
            <p className="mt-1 text-sm text-brand-muted">Manage household lists and account preferences.</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="list-management-heading" className="space-y-4">
        <div>
          <h2 id="list-management-heading" className="flex items-center gap-2 text-lg font-bold text-brand-ink">
            <List className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            List Management
          </h2>
          <p className="mt-1 text-sm text-brand-muted">Manage separate Income and Expense category lists.</p>
        </div>

        {message && <p className="rounded-xl border border-brand-line bg-brand-paper px-4 py-3 text-sm text-brand-ink" role="status">{message}</p>}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {renderCategoryList('income')}
          {renderCategoryList('expense')}
        </div>
      </section>

      <Dialog open={Boolean(editingCategory)} onClose={() => setEditingCategory(null)} titleId="edit-category-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="edit-category-title" className="text-lg font-bold text-brand-ink">Edit {editingCategory?.category_type || 'expense'} category</h3>
            <p className="mt-1 text-sm text-brand-muted">Rename the category or choose a different icon.</p>
          </div>
          <button type="button" onClick={() => setEditingCategory(null)} aria-label="Close edit category" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleEdit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="edit-category-name" className="mb-1 block text-sm font-medium text-brand-ink">Category name</label>
            <input id="edit-category-name" value={editName} onChange={event => setEditName(event.target.value)} maxLength={100} required className="w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" />
          </div>
          <div>
            <label htmlFor="edit-category-icon" className="mb-1 block text-sm font-medium text-brand-ink">Icon</label>
            <select id="edit-category-icon" value={editIcon} onChange={event => setEditIcon(event.target.value)} className="w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
              {AVAILABLE_ICONS.map(icon => <option key={icon.slug} value={icon.slug}>{icon.label}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" tone="secondary" onClick={() => setEditingCategory(null)}>Cancel</Button>
            <Button type="submit" tone="primary"><Check className="h-4 w-4" aria-hidden="true" />Save</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
