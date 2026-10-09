'use client';

import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { CategoryColor, DEFAULT_CATEGORY_COLORS } from '../../lib/categoryColors';

type Hsl = { hue: number; saturation: number; lightness: number };

function hexToHsl(hex: string): Hsl {
  const safeHex = /^#[\da-f]{6}$/i.test(hex) ? hex : '#C45116';
  const red = parseInt(safeHex.slice(1, 3), 16) / 255;
  const green = parseInt(safeHex.slice(3, 5), 16) / 255;
  const blue = parseInt(safeHex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
}

function hslToHex({ hue, saturation, lightness }: Hsl): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs(section % 2 - 1));
  let rgb: [number, number, number];

  if (section < 1) rgb = [chroma, secondary, 0];
  else if (section < 2) rgb = [secondary, chroma, 0];
  else if (section < 3) rgb = [0, chroma, secondary];
  else if (section < 4) rgb = [0, secondary, chroma];
  else if (section < 5) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];

  const offset = l - chroma / 2;
  return `#${rgb.map(channel => Math.round((channel + offset) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

type CategoryColorPickerProps = {
  idPrefix: string;
  value: CategoryColor;
  savedColors: CategoryColor[];
  onChange: (value: CategoryColor) => void;
  onSaveColor: () => void;
  onClose: () => void;
};

export function CategoryColorPicker({ idPrefix, value, savedColors, onChange, onSaveColor, onClose }: CategoryColorPickerProps) {
  const [hexDraft, setHexDraft] = useState(value.hex);
  const hsl = hexToHsl(value.hex);

  useEffect(() => setHexDraft(value.hex), [value.hex]);

  const updateHsl = (next: Hsl) => onChange({ ...value, hex: hslToHex(next) });
  const setFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const saturation = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const lightness = 100 - Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    updateHsl({ ...hsl, saturation, lightness });
  };

  const handleShadeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    updateHsl({
      ...hsl,
      saturation: Math.min(100, Math.max(0, hsl.saturation + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0))),
      lightness: Math.min(100, Math.max(0, hsl.lightness + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0))),
    });
  };

  const handleHexChange = (nextHex: string) => {
    setHexDraft(nextHex);
    if (/^#[\da-f]{6}$/i.test(nextHex)) onChange({ ...value, hex: nextHex.toUpperCase() });
  };

  return (
    <section aria-labelledby={`${idPrefix}-color-picker-title`} className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 id={`${idPrefix}-color-picker-title`} className="font-semibold text-brand-ink">Color picker</h4>
        <button type="button" onClick={onClose} aria-label="Close color picker" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-muted hover:bg-brand-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div
        className="relative mt-3 h-44 touch-none overflow-hidden rounded-xl border border-brand-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
        style={{ backgroundColor: `hsl(${hsl.hue}, 100%, 50%)`, backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)' }}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness. Use arrow keys to adjust."
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsl.saturation)}
        aria-valuetext={`${Math.round(hsl.saturation)}% saturation, ${Math.round(hsl.lightness)}% brightness`}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setFromPointer(event); }}
        onPointerMove={event => { if (event.buttons > 0) setFromPointer(event); }}
        onKeyDown={handleShadeKeyDown}
      >
        <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgb(0_0_0/0.45)] ring-1 ring-black/20" style={{ left: `${hsl.saturation}%`, top: `${100 - hsl.lightness}%` }} />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor={`${idPrefix}-color-hue`} className="sr-only">Hue</label>
          <input id={`${idPrefix}-color-hue`} type="range" min="0" max="360" value={Math.round(hsl.hue)} onChange={event => updateHsl({ ...hsl, hue: Number(event.target.value) })} className="h-3 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" style={{ background: 'linear-gradient(90deg, #F00, #FF0, #0F0, #0FF, #00F, #F0F, #F00)' }} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-color-opacity`} className="sr-only">Opacity</label>
          <input id={`${idPrefix}-color-opacity`} type="range" min="0" max="100" value={value.opacity} onChange={event => onChange({ ...value, opacity: Number(event.target.value) })} className="h-3 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" style={{ background: `linear-gradient(90deg, transparent, ${value.hex}), repeating-conic-gradient(#d9d9d9 0% 25%, #fff 0% 50%) 50% / 12px 12px` }} />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${idPrefix}-color-native`} className="sr-only">Choose color</label>
          <input id={`${idPrefix}-color-native`} type="color" value={value.hex} onChange={event => { onChange({ ...value, hex: event.target.value.toUpperCase() }); setHexDraft(event.target.value.toUpperCase()); }} className="h-10 w-12 cursor-pointer rounded-lg border border-brand-line bg-white p-1" />
          <label htmlFor={`${idPrefix}-color-hex`} className="sr-only">Hex color</label>
          <input id={`${idPrefix}-color-hex`} value={hexDraft} onChange={event => handleHexChange(event.target.value)} onBlur={() => { if (!/^#[\da-f]{6}$/i.test(hexDraft)) setHexDraft(value.hex); }} maxLength={7} spellCheck={false} className="min-w-0 flex-1 rounded-lg border border-brand-line px-3 py-2 text-sm uppercase text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" />
          <span className="text-xs tabular-nums text-brand-muted">{value.opacity}%</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-medium text-brand-ink">Saved colors</p>
        <button type="button" onClick={onSaveColor} aria-label="Save selected color" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-ink hover:bg-brand-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Saved colors">
        {savedColors.map((color, index) => (
          <button
            key={`${color.hex}-${color.opacity}-${index}`}
            type="button"
            onClick={() => { onChange(color); setHexDraft(color.hex); }}
            aria-label={`Use color ${color.hex}, ${color.opacity}% opacity`}
            aria-pressed={color.hex === value.hex && color.opacity === value.opacity}
            className={`h-7 w-7 rounded-full border border-brand-ink/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${color.hex === value.hex && color.opacity === value.opacity ? 'ring-2 ring-brand-orange ring-offset-2' : ''}`}
            style={{ backgroundColor: color.hex, opacity: color.opacity / 100 }}
          />
        ))}
      </div>
    </section>
  );
}
