export type CategoryColor = { hex: string; opacity: number };
export type CategoryColorPreferences = {
  byCategoryName: Record<string, CategoryColor>;
  savedColors: CategoryColor[];
};

export const CATEGORY_COLOR_STORAGE_KEY = 'famledger-category-colors-v1';
export const DEFAULT_CATEGORY_COLORS: CategoryColor[] = [
  { hex: '#7B61D1', opacity: 100 },
  { hex: '#20B879', opacity: 100 },
  { hex: '#F36B3F', opacity: 100 },
  { hex: '#E94D74', opacity: 100 },
  { hex: '#F3C623', opacity: 100 },
  { hex: '#149E91', opacity: 100 },
  { hex: '#55C7DA', opacity: 100 },
  { hex: '#3D83F6', opacity: 100 },
  { hex: '#16263D', opacity: 100 },
];

export const EMPTY_CATEGORY_COLOR_PREFERENCES: CategoryColorPreferences = {
  byCategoryName: {},
  savedColors: DEFAULT_CATEGORY_COLORS,
};

const isCategoryColor = (value: unknown): value is CategoryColor => (
  Boolean(value)
  && typeof value === 'object'
  && typeof (value as CategoryColor).hex === 'string'
  && /^#[\da-f]{6}$/i.test((value as CategoryColor).hex)
  && Number.isFinite((value as CategoryColor).opacity)
);

function normalizeColor(value: CategoryColor): CategoryColor {
  return { hex: value.hex.toUpperCase(), opacity: Math.min(100, Math.max(0, value.opacity)) };
}

export function readCategoryColorPreferences(): CategoryColorPreferences {
  if (typeof window === 'undefined') return EMPTY_CATEGORY_COLOR_PREFERENCES;
  try {
    const stored = window.localStorage.getItem(CATEGORY_COLOR_STORAGE_KEY);
    if (!stored) return EMPTY_CATEGORY_COLOR_PREFERENCES;
    const parsed = JSON.parse(stored) as Partial<CategoryColorPreferences>;
    const byCategoryName: Record<string, CategoryColor> = {};
    if (parsed.byCategoryName && typeof parsed.byCategoryName === 'object') {
      for (const [key, color] of Object.entries(parsed.byCategoryName)) {
        if (isCategoryColor(color)) byCategoryName[key] = normalizeColor(color);
      }
    }
    const savedColors = Array.isArray(parsed.savedColors) ? parsed.savedColors.filter(isCategoryColor).map(normalizeColor) : [];
    const uniqueColors = [...DEFAULT_CATEGORY_COLORS, ...savedColors].filter((color, index, all) => all.findIndex(item => item.hex === color.hex && item.opacity === color.opacity) === index);
    return { byCategoryName, savedColors: uniqueColors.slice(-18) };
  } catch {
    return EMPTY_CATEGORY_COLOR_PREFERENCES;
  }
}

export function writeCategoryColorPreferences(preferences: CategoryColorPreferences): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(CATEGORY_COLOR_STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function getStoredCategoryColor(categoryType: string, categoryName: string): CategoryColor | undefined {
  const preferences = readCategoryColorPreferences();
  const key = `${categoryType}:${categoryName.trim().toLocaleLowerCase()}`;
  return preferences.byCategoryName[key];
}
