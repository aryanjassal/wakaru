import { existsSync, readFileSync } from 'node:fs';
import {
  type BadgeVariant,
  type Rgb24,
  type TextStyle,
  type ThemeDefinition,
  draculaTheme,
  extendTheme,
  nordTheme,
  rgb,
} from '@rezi-ui/core';
import type { ThemeName } from './types.js';
import {
  customThemeSchema,
  parseJsonText,
  parseWithSchema,
} from './wakaru/schemas.js';

type ThemeSpec = Readonly<{
  label: string;
  badge: BadgeVariant;
  theme: ThemeDefinition;
}>;

export const PRODUCT_NAME = 'Wakaru';
export const PRODUCT_TAGLINE = 'Japanese sentence mining for Anki';
export const SPACE = {
  xs: 1,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
} as const;

const THEME_ORDER: readonly ThemeName[] = ['night', 'day', 'custom'];

const WAKARU_NIGHT = extendTheme(draculaTheme, {
  name: 'wakaru-night',
  colors: {
    bg: {
      base: rgb(11, 15, 22),
      elevated: rgb(18, 25, 35),
      overlay: rgb(25, 34, 47),
      subtle: rgb(14, 20, 29),
    },
    fg: {
      primary: rgb(238, 243, 247),
      secondary: rgb(172, 194, 210),
      muted: rgb(96, 118, 137),
      inverse: rgb(11, 15, 22),
    },
    accent: {
      primary: rgb(94, 214, 181),
      secondary: rgb(104, 166, 255),
      tertiary: rgb(245, 202, 103),
    },
    info: rgb(104, 166, 255),
    success: rgb(94, 214, 181),
    warning: rgb(245, 202, 103),
    error: rgb(255, 116, 139),
    selected: {
      bg: rgb(35, 84, 76),
      fg: rgb(238, 243, 247),
    },
    border: {
      subtle: rgb(39, 54, 72),
      default: rgb(61, 84, 109),
      strong: rgb(94, 214, 181),
    },
    focus: {
      ring: rgb(94, 214, 181),
      bg: rgb(31, 75, 67),
    },
  },
});

const WAKARU_DAY = extendTheme(nordTheme, {
  name: 'wakaru-day',
  colors: {
    bg: {
      base: rgb(18, 29, 35),
      elevated: rgb(26, 41, 49),
      overlay: rgb(35, 54, 64),
      subtle: rgb(21, 34, 41),
    },
    fg: {
      primary: rgb(241, 248, 246),
      secondary: rgb(188, 218, 211),
      muted: rgb(116, 148, 145),
      inverse: rgb(18, 29, 35),
    },
    accent: {
      primary: rgb(82, 190, 160),
      secondary: rgb(78, 143, 206),
      tertiary: rgb(231, 184, 90),
    },
    info: rgb(78, 143, 206),
    success: rgb(82, 190, 160),
    warning: rgb(231, 184, 90),
    error: rgb(225, 91, 113),
    selected: {
      bg: rgb(45, 110, 96),
      fg: rgb(241, 248, 246),
    },
    border: {
      subtle: rgb(54, 78, 84),
      default: rgb(74, 108, 116),
      strong: rgb(82, 190, 160),
    },
    focus: {
      ring: rgb(82, 190, 160),
      bg: rgb(42, 93, 83),
    },
  },
});

export type WakaruStyles = Readonly<{
  rootStyle: TextStyle;
  panelStyle: TextStyle;
  mutedStyle: TextStyle;
  accentStyle: TextStyle;
  dangerStyle: TextStyle;
}>;

export type WakaruThemeTokens = Readonly<{
  bg: Readonly<{
    app: Rgb24;
    panel: Readonly<{
      base: Rgb24;
      inset: Rgb24;
      elevated: Rgb24;
    }>;
    modal: Rgb24;
  }>;
  border: Readonly<{
    default: Rgb24;
    muted: Rgb24;
    focus: Rgb24;
    danger: Rgb24;
  }>;
  text: Readonly<{
    primary: Rgb24;
    muted: Rgb24;
    dim: Rgb24;
  }>;
  accent: Readonly<{
    info: Rgb24;
    success: Rgb24;
    warn: Rgb24;
    danger: Rgb24;
    brand: Rgb24;
  }>;
  state: Readonly<{
    selectedBg: Rgb24;
    selectedText: Rgb24;
  }>;
  progress: Readonly<{
    track: Rgb24;
    fill: Rgb24;
  }>;
  table: Readonly<{
    rowAltBg: Rgb24;
    rowSelectedBg: Rgb24;
  }>;
}>;

let customSpec: ThemeSpec | null = null;

function parseHexColor(value: string): Rgb24 | null {
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const raw = Number.parseInt(match[1] ?? '', 16);
  if (!Number.isFinite(raw)) return null;
  return raw;
}

function colorFromMap(
  colors: Readonly<Partial<Record<string, string>>> | undefined,
  key: string,
  fallback: Rgb24
): Rgb24 {
  const parsed = colors?.[key] ? parseHexColor(colors[key]) : null;
  return parsed ?? fallback;
}

function rgbChannel(value: Rgb24, shift: number): number {
  return (value >> shift) & 0xff;
}

function packRgb(value: number): Rgb24 {
  return value & 0xffffff;
}

function blend(a: Rgb24, b: Rgb24, weight: number): Rgb24 {
  const safe = Math.max(0, Math.min(1, weight));
  const channel = (shift: number) =>
    Math.round(
      rgbChannel(a, shift) +
        (rgbChannel(b, shift) - rgbChannel(a, shift)) * safe
    );
  return rgb(channel(16), channel(8), channel(0));
}

function buildCustomTheme(path: string): ThemeSpec | null {
  if (!path || !existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  const json = parseJsonText(text, `Theme file ${path}`);
  if (!json.success) throw json.error;
  const parsed = parseWithSchema(
    customThemeSchema,
    json.value,
    `Theme file ${path}`
  );
  const colors = parsed.colors;
  const night = WAKARU_NIGHT.colors;
  const theme = extendTheme(WAKARU_NIGHT, {
    name: 'wakaru-custom',
    colors: {
      bg: {
        base: colorFromMap(colors, 'base', packRgb(night.bg.base)),
        elevated: colorFromMap(colors, 'panel', packRgb(night.bg.elevated)),
        overlay: colorFromMap(
          colors,
          'panelElevated',
          packRgb(night.bg.overlay)
        ),
        subtle: colorFromMap(colors, 'panelInset', packRgb(night.bg.subtle)),
      },
      fg: {
        primary: colorFromMap(colors, 'text', packRgb(night.fg.primary)),
        secondary: colorFromMap(colors, 'muted', packRgb(night.fg.secondary)),
        muted: colorFromMap(colors, 'dim', packRgb(night.fg.muted)),
        inverse: colorFromMap(colors, 'inverse', packRgb(night.fg.inverse)),
      },
      accent: {
        primary: colorFromMap(colors, 'accent', packRgb(night.accent.primary)),
        secondary: colorFromMap(
          colors,
          'info',
          packRgb(night.accent.secondary)
        ),
        tertiary: colorFromMap(
          colors,
          'warning',
          packRgb(night.accent.tertiary)
        ),
      },
      info: colorFromMap(colors, 'info', packRgb(night.info)),
      success: colorFromMap(colors, 'success', packRgb(night.success)),
      warning: colorFromMap(colors, 'warning', packRgb(night.warning)),
      error: colorFromMap(colors, 'danger', packRgb(night.error)),
      selected: {
        bg: colorFromMap(colors, 'selected', packRgb(night.selected.bg)),
        fg: colorFromMap(colors, 'selectedText', packRgb(night.selected.fg)),
      },
      border: {
        subtle: colorFromMap(
          colors,
          'borderMuted',
          packRgb(night.border.subtle)
        ),
        default: colorFromMap(colors, 'border', packRgb(night.border.default)),
        strong: colorFromMap(colors, 'focus', packRgb(night.border.strong)),
      },
      focus: {
        ring: colorFromMap(colors, 'focus', packRgb(night.focus.ring)),
        bg: colorFromMap(colors, 'focusBg', packRgb(night.focus.bg)),
      },
    },
  });
  return {
    label: parsed.label,
    badge: 'info',
    theme,
  };
}

export function configureCustomTheme(path: string): void {
  customSpec = buildCustomTheme(path);
}

export function themeSpec(themeName: ThemeName): ThemeSpec {
  if (themeName === 'custom') {
    return (
      customSpec ?? {
        label: 'Custom missing',
        badge: 'warning',
        theme: WAKARU_NIGHT,
      }
    );
  }
  if (themeName === 'day')
    return { label: 'Day', badge: 'success', theme: WAKARU_DAY };
  return { label: 'Night', badge: 'info', theme: WAKARU_NIGHT };
}

export function cycleThemeName(current: ThemeName): ThemeName {
  const available: readonly ThemeName[] = customSpec
    ? THEME_ORDER
    : ['night', 'day'];
  const index = available.indexOf(current);
  const next = index < 0 ? 0 : (index + 1) % available.length;
  return available[next] ?? 'night';
}

export function toHex(color: Rgb24): string {
  const channel = (value: number) => value.toString(16).padStart(2, '0');
  return `#${channel(rgbChannel(color, 16))}${channel(rgbChannel(color, 8))}${channel(rgbChannel(color, 0))}`;
}

export function themeTokens(themeName: ThemeName): WakaruThemeTokens {
  const colors = themeSpec(themeName).theme.colors;
  const panelBase = packRgb(colors.bg.elevated);
  const panelInset = packRgb(colors.bg.subtle);
  const panelElevated = packRgb(colors.bg.overlay);
  const selectedBg = packRgb(colors.selected.bg);
  const accentBrand = packRgb(colors.accent.primary);
  return {
    bg: {
      app: packRgb(colors.bg.base),
      panel: {
        base: panelBase,
        inset: panelInset,
        elevated: panelElevated,
      },
      modal: panelElevated,
    },
    border: {
      default: packRgb(colors.border.default),
      muted: packRgb(colors.border.subtle),
      focus: packRgb(colors.focus.ring),
      danger: packRgb(colors.error),
    },
    text: {
      primary: packRgb(colors.fg.primary),
      muted: packRgb(colors.fg.secondary),
      dim: packRgb(colors.fg.muted),
    },
    accent: {
      info: packRgb(colors.info),
      success: packRgb(colors.success),
      warn: packRgb(colors.warning),
      danger: packRgb(colors.error),
      brand: accentBrand,
    },
    state: {
      selectedBg,
      selectedText: packRgb(colors.selected.fg),
    },
    progress: {
      track: blend(panelInset, packRgb(colors.border.subtle), 0.65),
      fill: accentBrand,
    },
    table: {
      rowAltBg: blend(panelBase, panelInset, 0.45),
      rowSelectedBg: selectedBg,
    },
  };
}

export function stylesForTheme(themeName: ThemeName): WakaruStyles {
  const tokens = themeTokens(themeName);
  return {
    rootStyle: { bg: tokens.bg.app, fg: tokens.text.primary },
    panelStyle: { bg: tokens.bg.panel.base, fg: tokens.text.primary },
    mutedStyle: { fg: tokens.text.muted, dim: true },
    accentStyle: { fg: tokens.accent.brand, bold: true },
    dangerStyle: {
      fg: tokens.accent.danger,
      bg: tokens.bg.panel.base,
      bold: true,
    },
  };
}
