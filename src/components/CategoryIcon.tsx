'use client';

import React from 'react';
import { 
  ShoppingCart, Zap, Utensils, Film, BookOpen, GraduationCap, Bus, Car, Fuel, 
  HeartPulse, Home, ShieldCheck, Gift, Gamepad2, Plane, Scissors, Wifi, Smartphone, 
  Dumbbell, Baby, PawPrint, Wrench, Coffee, Music, CreditCard, Receipt, LucideIcon 
} from 'lucide-react';

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
  { slug: 'receipt', label: 'General Receipt', icon: Receipt, color: 'text-slate-300' },
];

export const CategoryIcon: React.FC<{ slug: string; className?: string }> = ({ slug, className = 'w-5 h-5' }) => {
  const found = AVAILABLE_ICONS.find(i => i.slug === slug) || AVAILABLE_ICONS[AVAILABLE_ICONS.length - 1];
  const IconComponent = found.icon;
  return <IconComponent className={`${className} ${found.color}`} />;
};

interface IconPickerGridProps {
  selectedSlug: string;
  onSelectSlug: (slug: string) => void;
}

export const IconPickerGrid: React.FC<IconPickerGridProps> = ({ selectedSlug, onSelectSlug }) => {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-300">Choose Icon Style</label>
      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 p-3 bg-slate-950/80 rounded-xl border border-slate-700/80 max-h-48 overflow-y-auto scrollbar-none">
        {AVAILABLE_ICONS.map(item => {
          const IconComp = item.icon;
          const isSelected = selectedSlug === item.slug;
          return (
            <button
              type="button"
              key={item.slug}
              onClick={() => onSelectSlug(item.slug)}
              title={item.label}
              className={`p-2.5 rounded-lg flex flex-col items-center justify-center transition-all ${
                isSelected 
                  ? 'bg-sky-500/20 border-2 border-sky-400 ring-2 ring-sky-500/30 scale-105' 
                  : 'bg-slate-800/80 border border-slate-700/60 hover:bg-slate-700 hover:border-slate-500'
              }`}
            >
              <IconComp className={`w-5 h-5 ${item.color}`} />
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-400">
        Selected Icon: <span className="font-semibold text-white">{AVAILABLE_ICONS.find(i => i.slug === selectedSlug)?.label || 'Default'}</span>
      </p>
    </div>
  );
};
