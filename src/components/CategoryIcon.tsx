'use client';

import React, { useEffect, useState } from 'react';
import { 
  ShoppingCart, Zap, Utensils, Film, BookOpen, GraduationCap, Bus, Car, Fuel, 
  HeartPulse, Home, ShieldCheck, Gift, Gamepad2, Plane, Scissors, Wifi, Smartphone, 
  Dumbbell, Baby, PawPrint, Wrench, Coffee, Music, CreditCard, Receipt, LucideIcon, TrendingUp,
  Banknote, Briefcase, CircleDollarSign, Coins, PiggyBank, Wallet, HandCoins, Landmark,
  Handshake, Building2, BadgePercent, Laptop, Store, ChartNoAxesCombined, HeartHandshake,
  FileText, CirclePlus, Shirt, Stethoscope, Shield, ClipboardList,
} from 'lucide-react';
import { CategoryColor, getCategoryColorPresentation, getStoredCategoryColor } from '../lib/categoryColors';

export interface IconOption {
  slug: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const AVAILABLE_ICONS: IconOption[] = [
  { slug: 'shopping-cart', label: 'Groceries', icon: ShoppingCart, color: 'text-sky-400' },
  { slug: 'book-open', label: 'School Supplies', icon: BookOpen, color: 'text-amber-400' },
  { slug: 'graduation-cap', label: 'School Dues & Tuition', icon: GraduationCap, color: 'text-indigo-400' },
  { slug: 'bus', label: 'School Bus / Transport', icon: Bus, color: 'text-emerald-400' },
  { slug: 'zap', label: 'Utilities & Power', icon: Zap, color: 'text-yellow-400' },
  { slug: 'utensils', label: 'Dining & Restaurants', icon: Utensils, color: 'text-rose-400' },
  { slug: 'film', label: 'Entertainment & Movies', icon: Film, color: 'text-purple-400' },
  { slug: 'gamepad-2', label: 'Gaming & Hobbies', icon: Gamepad2, color: 'text-cyan-400' },
  { slug: 'heart-pulse', label: 'Healthcare & Medical', icon: HeartPulse, color: 'text-red-400' },
  { slug: 'home', label: 'Housing & Rent', icon: Home, color: 'text-sky-300' },
  { slug: 'car', label: 'Auto & Car Expenses', icon: Car, color: 'text-orange-400' },
  { slug: 'fuel', label: 'Fuel & Gas', icon: Fuel, color: 'text-amber-500' },
  { slug: 'gift', label: 'Gifts & Celebrations', icon: Gift, color: 'text-pink-400' },
  { slug: 'plane', label: 'Travel & Vacations', icon: Plane, color: 'text-blue-400' },
  { slug: 'scissors', label: 'Personal Care & Salon', icon: Scissors, color: 'text-teal-400' },
  { slug: 'wifi', label: 'Internet & Broadband', icon: Wifi, color: 'text-indigo-300' },
  { slug: 'smartphone', label: 'Mobile & Load', icon: Smartphone, color: 'text-emerald-300' },
  { slug: 'dumbbell', label: 'Gym & Fitness', icon: Dumbbell, color: 'text-lime-400' },
  { slug: 'baby', label: 'Childcare & Kids', icon: Baby, color: 'text-pink-300' },
  { slug: 'paw-print', label: 'Pets & Veterinary', icon: PawPrint, color: 'text-amber-300' },
  { slug: 'wrench', label: 'Repairs & Hardware', icon: Wrench, color: 'text-slate-400' },
  { slug: 'coffee', label: 'Cafes & Snacks', icon: Coffee, color: 'text-amber-600' },
  { slug: 'music', label: 'Music & Streaming', icon: Music, color: 'text-violet-400' },
  { slug: 'credit-card', label: 'Loans & Bills', icon: CreditCard, color: 'text-rose-300' },
  { slug: 'trending-up', label: 'Income & Salary', icon: TrendingUp, color: 'text-emerald-400' },
  { slug: 'receipt', label: 'General Receipt', icon: Receipt, color: 'text-slate-300' },
  { slug: 'banknote', label: 'Paycheck', icon: Banknote, color: 'text-emerald-400' },
  { slug: 'briefcase', label: 'Work & Freelance', icon: Briefcase, color: 'text-indigo-300' },
  { slug: 'circle-dollar-sign', label: 'Cash Income', icon: CircleDollarSign, color: 'text-green-400' },
  { slug: 'coins', label: 'Investment Returns', icon: Coins, color: 'text-amber-400' },
  { slug: 'piggy-bank', label: 'Savings', icon: PiggyBank, color: 'text-pink-300' },
  { slug: 'wallet', label: 'Wallet', icon: Wallet, color: 'text-sky-300' },
  { slug: 'hand-coins', label: 'Allowance', icon: HandCoins, color: 'text-yellow-400' },
  { slug: 'landmark', label: 'Bank', icon: Landmark, color: 'text-slate-300' },
  { slug: 'handshake', label: 'Reimbursement', icon: Handshake, color: 'text-teal-300' },
  { slug: 'building-2', label: 'Rental Income', icon: Building2, color: 'text-orange-300' },
  { slug: 'badge-percent', label: 'Discounts', icon: BadgePercent, color: 'text-rose-300' },
  { slug: 'laptop', label: 'Online Services', icon: Laptop, color: 'text-cyan-300' },
  { slug: 'store', label: 'Business Income', icon: Store, color: 'text-lime-300' },
  { slug: 'chart-no-axes-combined', label: 'Profit & Growth', icon: ChartNoAxesCombined, color: 'text-emerald-300' },
  { slug: 'heart-handshake', label: 'Support & Donations', icon: HeartHandshake, color: 'text-red-300' },
  { slug: 'file-text', label: 'Invoices', icon: FileText, color: 'text-blue-300' },
  { slug: 'circle-plus', label: 'Other Income', icon: CirclePlus, color: 'text-violet-300' },
  { slug: 'shirt', label: 'Clothing', icon: Shirt, color: 'text-purple-300' },
  { slug: 'stethoscope', label: 'Medical Care', icon: Stethoscope, color: 'text-red-300' },
  { slug: 'shield', label: 'Insurance', icon: Shield, color: 'text-sky-300' },
  { slug: 'clipboard-list', label: 'General Services', icon: ClipboardList, color: 'text-amber-300' },
];

export const CategoryIcon: React.FC<{ slug: string; className?: string; color?: string; opacity?: number; categoryType?: string; categoryName?: string }> = ({ slug, className = 'w-5 h-5', color, opacity, categoryType, categoryName }) => {
  const [storedColor, setStoredColor] = useState<CategoryColor | undefined>();
  useEffect(() => {
    setStoredColor(categoryType && categoryName ? getStoredCategoryColor(categoryType, categoryName) : undefined);
  }, [categoryType, categoryName]);

  const found = AVAILABLE_ICONS.find(i => i.slug === slug) || AVAILABLE_ICONS[AVAILABLE_ICONS.length - 1];
  const IconComponent = found.icon;
  const iconColor = color || storedColor?.hex;
  const iconOpacity = opacity ?? storedColor?.opacity;
  return <IconComponent className={`${className} ${found.color}`} style={iconColor ? { color: iconColor, opacity: (iconOpacity ?? 100) / 100 } : undefined} aria-hidden="true" />;
};

interface CategoryIconTileProps {
  slug: string;
  className?: string;
  iconClassName?: string;
  categoryType?: string;
  categoryName?: string;
  color?: CategoryColor;
  fallbackClassName?: string;
  fallbackColorHex?: string;
  baseHex?: string;
}

export const CategoryIconTile: React.FC<CategoryIconTileProps> = ({
  slug,
  className = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
  iconClassName = 'h-4 w-4',
  categoryType,
  categoryName,
  color,
  fallbackClassName = 'bg-brand-sky',
  fallbackColorHex = '#D9F0F7',
  baseHex = '#FFFFFF',
}) => {
  const [storedColor, setStoredColor] = useState<CategoryColor | undefined>();
  useEffect(() => {
    setStoredColor(categoryType && categoryName ? getStoredCategoryColor(categoryType, categoryName) : undefined);
  }, [categoryType, categoryName]);

  const selectedColor = color || storedColor;
  const presentation = selectedColor
    ? getCategoryColorPresentation(selectedColor, baseHex)
    : getCategoryColorPresentation({ hex: fallbackColorHex, opacity: 100 });

  return (
    <span className={`${className} ${selectedColor ? '' : fallbackClassName}`} style={selectedColor ? { backgroundColor: presentation.background } : undefined}>
      <CategoryIcon
        slug={slug}
        className={iconClassName}
        color={presentation.foreground}
        opacity={100}
      />
    </span>
  );
};

interface IconPickerGridProps {
  selectedSlug: string;
  onSelectSlug: (slug: string) => void;
  selectedColor?: CategoryColor;
}

export const IconPickerGrid: React.FC<IconPickerGridProps> = ({ selectedSlug, onSelectSlug, selectedColor }) => {
  const selectedPresentation = selectedColor ? getCategoryColorPresentation(selectedColor) : undefined;
  return (
    <div className="space-y-2">
      <p className="block text-sm font-medium text-brand-ink">Choose icon style</p>
      <div className="grid max-h-52 grid-cols-6 gap-2 overflow-y-auto rounded-xl border border-brand-line bg-brand-canvas p-3 sm:grid-cols-8">
        {AVAILABLE_ICONS.map(item => {
          const IconComp = item.icon;
          const isSelected = selectedSlug === item.slug;
          return (
            <button
              type="button"
              key={item.slug}
              onClick={() => onSelectSlug(item.slug)}
              title={item.label}
              aria-label={item.label}
              aria-pressed={isSelected}
              className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${
                isSelected 
                  ? 'border-brand-orange bg-brand-sky ring-2 ring-brand-orange/20'
                  : 'border-brand-line bg-white hover:bg-brand-paper hover:border-brand-muted'
              }`}
              style={isSelected && selectedPresentation ? { backgroundColor: selectedPresentation.background } : undefined}
            >
              <IconComp className={`h-5 w-5 ${isSelected && selectedPresentation ? '' : item.color}`} style={isSelected && selectedPresentation ? { color: selectedPresentation.foreground } : undefined} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="text-xs text-brand-muted" aria-live="polite">
        Selected icon: <span className="font-semibold text-brand-ink">{AVAILABLE_ICONS.find(i => i.slug === selectedSlug)?.label || 'Default'}</span>
      </p>
    </div>
  );
};
