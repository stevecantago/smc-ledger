'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { Check, CircleArrowDown, CircleArrowUp, Coins, List, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { Category, CategoryType } from '../types/database';
import { CategoryColor, CategoryColorPreferences, DEFAULT_CATEGORY_COLORS, EMPTY_CATEGORY_COLOR_PREFERENCES, readCategoryColorPreferences, writeCategoryColorPreferences } from '../lib/categoryColors';
import { IconPickerGrid, CategoryIconTile } from './CategoryIcon';
import { Button } from './ui/Button';
import { CategoryColorPicker } from './ui/CategoryColorPicker';
import { Dialog } from './ui/Dialog';

const DEFAULT_TYPE_COLORS: Record<CategoryType, CategoryColor> = {
  income: { hex: '#168B63', opacity: 100 },
  expense: { hex: '#C45116', opacity: 100 },
};

const listMeta: Record<CategoryType, { title: string; addTitle: string; icon: typeof CircleArrowUp }> = {
  income: { title: 'Income Categories', addTitle: 'Add Income Category Type', icon: CircleArrowUp },
  expense: { title: 'Expense Categories', addTitle: 'Add Expense Category Type', icon: CircleArrowDown },
};

const categorySuggestions: Record<CategoryType, string[]> = {
  income: ['Salary', 'Profit', 'Investment', 'Other', 'Gift', 'Bonus', 'Freelance', 'Rental Income'],
  expense: ['Food', 'Transport', 'Utilities', 'Entertainment', 'Healthcare', 'Education', 'Housing', 'Travel'],
};

const DISPLAY_CURRENCY_STORAGE_KEY = 'famledger-display-currency-v1';
type DisplayCurrency = 'PHP' | 'USD';

const getCategoryColorKey = (type: CategoryType, name: string) => `${type}:${name.trim().toLocaleLowerCase()}`;

export const SettingsView: React.FC = () => {
  const { categories, hasPermission, addCategory, updateCategory, deleteCategory } = useHousehold();
  const canManageCategories = hasPermission('manage_categories');
  const [addingType, setAddingType] = useState<CategoryType | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('trending-up');
  const [newMonthlyLimit, setNewMonthlyLimit] = useState('0.00');
  const [newColor, setNewColor] = useState<CategoryColor>(DEFAULT_TYPE_COLORS.income);
  const [showNewColorPicker, setShowNewColorPicker] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editMonthlyLimit, setEditMonthlyLimit] = useState('0.00');
  const [editColor, setEditColor] = useState<CategoryColor>(DEFAULT_TYPE_COLORS.expense);
  const [showEditColorPicker, setShowEditColorPicker] = useState(false);
  const [colorPreferences, setColorPreferences] = useState<CategoryColorPreferences>(EMPTY_CATEGORY_COLOR_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('PHP');
  const [displayCurrencyLoaded, setDisplayCurrencyLoaded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setColorPreferences(readCategoryColorPreferences());
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    try {
      const savedCurrency = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
      if (savedCurrency === 'PHP' || savedCurrency === 'USD') setDisplayCurrency(savedCurrency);
    } catch {
      // Keep PHP as the safe default when browser storage is unavailable.
    }
    setDisplayCurrencyLoaded(true);
  }, []);

  useEffect(() => {
    if (!displayCurrencyLoaded) return;
    try {
      window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, displayCurrency);
    } catch {
      setMessage('Currency preference could not be saved on this device.');
    }
  }, [displayCurrency, displayCurrencyLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      if (!writeCategoryColorPreferences(colorPreferences)) throw new Error('Could not write color preferences');
    } catch {
      setMessage('Color preferences could not be saved on this device.');
    }
  }, [colorPreferences, preferencesLoaded]);

  const beginAdd = (type: CategoryType) => {
    setAddingType(type);
    setNewName('');
    setNewIcon(type === 'income' ? 'trending-up' : 'shopping-cart');
    setNewMonthlyLimit('0.00');
    setNewColor(DEFAULT_TYPE_COLORS[type]);
    setShowNewColorPicker(false);
    setMessage('');
  };

  const closeAdd = () => {
    setAddingType(null);
    setShowNewColorPicker(false);
  };

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!addingType) return;
    const name = newName.trim();
    if (!name) return;
    const parsedLimit = Number(newMonthlyLimit);
    if (editMonthlyLimit.trim() === '' || !Number.isFinite(parsedLimit) || parsedLimit < 0) {
      setMessage('Enter a valid monthly budget limit.');
      return;
    }

    const result = addCategory({
      name,
      icon_slug: newIcon,
      category_type: addingType,
      monthly_budget_limit: parsedLimit,
    });
    if (!result.success) {
      setMessage(result.error || `Could not add this ${addingType} category.`);
      return;
    }

    const colorKey = getCategoryColorKey(addingType, name);
    setColorPreferences(previous => ({ ...previous, byCategoryName: { ...previous.byCategoryName, [colorKey]: newColor } }));
    setMessage(`${name} added to ${listMeta[addingType].title}.`);
    closeAdd();
  };

  const beginEdit = (category: Category) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditIcon(category.icon_slug);
    setEditMonthlyLimit(String(category.monthly_budget_limit));
    setEditColor(colorPreferences.byCategoryName[getCategoryColorKey(category.category_type, category.name)] || DEFAULT_TYPE_COLORS[category.category_type]);
    setShowEditColorPicker(false);
    setMessage('');
  };

  const handleEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategory) return;
    const name = editName.trim();
    if (!name) return;
    const parsedLimit = Number(editMonthlyLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      setMessage('Enter a valid monthly budget limit.');
      return;
    }

    const result = updateCategory(editingCategory.id, { name, icon_slug: editIcon, monthly_budget_limit: parsedLimit });
    if (!result.success) {
      setMessage(result.error || 'Could not update this category.');
      return;
    }

    const previousKey = getCategoryColorKey(editingCategory.category_type, editingCategory.name);
    const nextKey = getCategoryColorKey(editingCategory.category_type, name);
    setColorPreferences(previous => {
      const byCategoryName = { ...previous.byCategoryName };
      delete byCategoryName[previousKey];
      byCategoryName[nextKey] = editColor;
      return { ...previous, byCategoryName };
    });
    setEditingCategory(null);
    setMessage(`${name} updated.`);
  };

  const handleDelete = (category: Category) => {
    const label = category.category_type === 'income' ? 'income' : 'expense';
    if (!window.confirm(`Delete ${label} category “${category.name}”?`)) return;
    const result = deleteCategory(category.id);
    if (result.success) {
      const key = getCategoryColorKey(category.category_type, category.name);
      setColorPreferences(previous => {
        const byCategoryName = { ...previous.byCategoryName };
        delete byCategoryName[key];
        return { ...previous, byCategoryName };
      });
    }
    setMessage(result.success ? `${category.name} deleted.` : result.error || 'Could not delete this category.');
  };

  const saveColor = (color: CategoryColor) => setColorPreferences(previous => {
    if (previous.savedColors.some(saved => saved.hex === color.hex && saved.opacity === color.opacity)) return previous;
    return { ...previous, savedColors: [...previous.savedColors, color].slice(-18) };
  });

  const renderCategoryList = (categoryType: CategoryType) => {
    const { title, icon: DirectionIcon } = listMeta[categoryType];
    const list = categories.filter(category => category.category_type === categoryType);
    const isIncome = categoryType === 'income';

    return (
      <section key={categoryType} aria-labelledby={`${categoryType}-categories-heading`} className="overflow-hidden rounded-2xl border border-brand-line bg-brand-paper shadow-[var(--fam-shadow)]">
        <div className="border-b border-brand-line bg-brand-paper px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id={`${categoryType}-categories-heading`} className="flex items-center gap-2 font-semibold text-brand-ink">
                <DirectionIcon className={`h-4 w-4 ${isIncome ? 'text-[#168B63]' : 'text-brand-orange'}`} aria-hidden="true" />
                {title}
              </h3>
              <p className="mt-1 text-xs text-brand-muted">{isIncome ? 'Used to label income entries.' : 'Used to label expense entries.'}</p>
            </div>
            {canManageCategories && (
              <Button type="button" tone="secondary" size="sm" onClick={() => beginAdd(categoryType)} aria-label={`Add ${isIncome ? 'income' : 'expense'} category`} className="shrink-0 border border-brand-line bg-white">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add type
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[320px] border-collapse text-left" aria-label={title}>
            <thead className="sticky top-0 bg-white text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Type</th>
                {canManageCategories && <th scope="col" className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {list.map(category => {
                const color = colorPreferences.byCategoryName[getCategoryColorKey(categoryType, category.name)];
                return (
                  <tr key={category.id} className="bg-white hover:bg-brand-canvas">
                    <th scope="row" className="px-4 py-2.5 font-medium text-brand-ink">
                      <span className="flex min-w-0 items-center gap-3">
                        <CategoryIconTile slug={category.icon_slug} categoryType={categoryType} categoryName={category.name} color={color} fallbackClassName={isIncome ? 'bg-brand-mint' : 'bg-brand-sky'} />
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
                );
              })}
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

      <section aria-labelledby="currency-preference-heading" className="rounded-2xl border border-brand-line bg-brand-paper p-5 shadow-[var(--fam-shadow)] sm:p-6">
        <h2 id="currency-preference-heading" className="flex items-center gap-2 text-lg font-bold text-brand-ink">
          <Coins className="h-5 w-5 text-brand-orange" aria-hidden="true" />
          Currency Preference
        </h2>
        <div className="mt-4 max-w-xl">
          <label htmlFor="display-currency" className="mb-1.5 block text-sm font-medium text-brand-ink">Display Currency</label>
          <select id="display-currency" value={displayCurrency} onChange={event => setDisplayCurrency(event.target.value as DisplayCurrency)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
            <option value="PHP">PHP (₱)</option>
            <option value="USD">USD ($)</option>
          </select>
          <p className="mt-2 text-xs text-brand-muted">Saved on this device. Existing amounts are not converted.</p>
        </div>
      </section>

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

      <Dialog open={Boolean(addingType)} onClose={closeAdd} titleId="add-category-title" className="max-w-xl">
        {addingType && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="add-category-title" className="text-lg font-extrabold uppercase tracking-wide text-brand-ink">{listMeta[addingType].addTitle}</h3>
                <p className="mt-1 text-sm text-brand-muted">Add a type to the {addingType} category list.</p>
              </div>
              <button type="button" onClick={closeAdd} aria-label="Close add category" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="mt-5 space-y-4">
              <div>
                <label htmlFor="new-category-name" className="mb-1.5 block text-sm font-medium text-brand-ink">Type name</label>
                <input id="new-category-name" list={`${addingType}-category-suggestions`} value={newName} onChange={event => setNewName(event.target.value)} placeholder={addingType === 'income' ? 'e.g. Salary, Profit, Investment' : 'e.g. Food, Healthcare, Transport'} maxLength={100} required autoComplete="off" className="w-full rounded-xl border border-brand-line bg-white px-3 py-3 text-sm text-brand-ink placeholder:text-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" />
                <datalist id={`${addingType}-category-suggestions`}>
                  {categorySuggestions[addingType].map(suggestion => <option key={suggestion} value={suggestion} />)}
                </datalist>
              </div>

              <div>
                <label htmlFor="new-category-monthly-limit" className="mb-1.5 block text-sm font-medium text-brand-ink">Monthly Budget Limit (₱ PHP)</label>
                <input id="new-category-monthly-limit" type="number" min="0" step="0.01" inputMode="decimal" value={newMonthlyLimit} onChange={event => setNewMonthlyLimit(event.target.value)} className="w-full rounded-xl border border-brand-line bg-white px-3 py-3 text-sm font-semibold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" />
              </div>

              <IconPickerGrid selectedSlug={newIcon} onSelectSlug={setNewIcon} selectedColor={newColor} />

              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-ink">Category color</p>
                <button type="button" onClick={() => setShowNewColorPicker(open => !open)} aria-expanded={showNewColorPicker} aria-controls="new-category-color-picker" className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink hover:bg-brand-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                  <span className="h-6 w-6 rounded-full border border-brand-ink/15" style={{ backgroundColor: newColor.hex, opacity: newColor.opacity / 100 }} />
                  <span>Choose color</span><span className="font-mono text-xs text-brand-muted">{newColor.hex}</span>
                </button>
                {showNewColorPicker && <div id="new-category-color-picker"><CategoryColorPicker idPrefix="new-category" value={newColor} savedColors={colorPreferences.savedColors} onChange={setNewColor} onSaveColor={() => saveColor(newColor)} onClose={() => setShowNewColorPicker(false)} /></div>}
              </div>

              <div className="flex justify-end gap-2 border-t border-brand-line pt-4">
                <Button type="button" tone="secondary" onClick={closeAdd}>Cancel</Button>
                <Button type="submit" tone="primary"><Plus className="h-4 w-4" aria-hidden="true" /> Add {addingType === 'income' ? 'Income' : 'Expense'} Type</Button>
              </div>
            </form>
          </>
        )}
      </Dialog>

      <Dialog open={Boolean(editingCategory)} onClose={() => setEditingCategory(null)} titleId="edit-category-title" className="max-w-xl">
        {editingCategory && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="edit-category-title" className="text-lg font-bold text-brand-ink">Edit {editingCategory.category_type} category</h3>
                <p className="mt-1 text-sm text-brand-muted">Update its name, icon, or color.</p>
              </div>
              <button type="button" onClick={() => setEditingCategory(null)} aria-label="Close edit category" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="edit-category-name" className="mb-1.5 block text-sm font-medium text-brand-ink">Type name</label>
                <input id="edit-category-name" value={editName} onChange={event => setEditName(event.target.value)} maxLength={100} required className="w-full rounded-xl border border-brand-line bg-white px-3 py-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" />
              </div>
              <div>
                <label htmlFor="edit-category-monthly-limit" className="mb-1.5 block text-sm font-medium text-brand-ink">Monthly Budget Limit (₱ PHP)</label>
                <input id="edit-category-monthly-limit" type="number" min="0" step="0.01" inputMode="decimal" value={editMonthlyLimit} onChange={event => setEditMonthlyLimit(event.target.value)} required className="w-full rounded-xl border border-brand-line bg-white px-3 py-3 text-sm font-semibold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" />
              </div>
              <IconPickerGrid selectedSlug={editIcon} onSelectSlug={setEditIcon} selectedColor={editColor} />
              <div className="space-y-2">
                <p className="text-sm font-medium text-brand-ink">Category color</p>
                <button type="button" onClick={() => setShowEditColorPicker(open => !open)} aria-expanded={showEditColorPicker} aria-controls="edit-category-color-picker" className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink hover:bg-brand-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                  <span className="h-6 w-6 rounded-full border border-brand-ink/15" style={{ backgroundColor: editColor.hex, opacity: editColor.opacity / 100 }} />
                  <span>Choose color</span><span className="font-mono text-xs text-brand-muted">{editColor.hex}</span>
                </button>
                {showEditColorPicker && <div id="edit-category-color-picker"><CategoryColorPicker idPrefix="edit-category" value={editColor} savedColors={colorPreferences.savedColors} onChange={setEditColor} onSaveColor={() => saveColor(editColor)} onClose={() => setShowEditColorPicker(false)} /></div>}
              </div>
              <div className="flex justify-end gap-2 border-t border-brand-line pt-4">
                <Button type="button" tone="secondary" onClick={() => setEditingCategory(null)}>Cancel</Button>
                <Button type="submit" tone="primary"><Check className="h-4 w-4" aria-hidden="true" /> Save changes</Button>
              </div>
            </form>
          </>
        )}
      </Dialog>
    </div>
  );
};
