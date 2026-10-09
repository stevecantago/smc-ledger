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

function parseRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [0, 2, 4].map(offset => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as [number, number, number];
}

function compositeColor(foreground: [number, number, number], background: [number, number, number], opacity: number): [number, number, number] {
  return foreground.map((channel, index) => Math.round(channel * opacity + background[index] * (1 - opacity))) as [number, number, number];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const linear = [red, green, blue].map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function getCategoryColorPresentation(color: CategoryColor, baseHex = '#FFFFFF') {
  const opacity = Math.min(100, Math.max(0, color.opacity)) / 100;
  const rgb = parseRgb(color.hex);
  const backgroundRgb = compositeColor(rgb, parseRgb(baseHex), opacity);
  const background = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  const luminance = relativeLuminance(backgroundRgb);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);

  return {
    background,
    foreground: contrastWithBlack >= contrastWithWhite ? '#000000' : '#FFFFFF',
  };
}

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
