export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidSlug(value: string): boolean {
  return SLUG_REGEX.test(value);
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getHostnameLabel(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
}

export function formatCompactUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${host}${path}`;
  } catch {
    return null;
  }
}

export const LIST_THEME_PRESETS = [
  { id: 'classic', label: 'Clásico', swatch: '#007aff' },
  { id: 'warm', label: 'Cálido', swatch: '#c67d3b' },
  { id: 'festive', label: 'Navidad', swatch: '#2e7d5b' },
  { id: 'editorial', label: 'Editorial', swatch: '#52525b' },
  { id: 'rose', label: 'Rosa', swatch: '#e11d48' },
  { id: 'lavender', label: 'Lavanda', swatch: '#7c3aed' },
  { id: 'ocean', label: 'Océano', swatch: '#0891b2' },
  { id: 'slate', label: 'Grafito', swatch: '#475569' },
] as const;

export type ValidThemePreset = (typeof LIST_THEME_PRESETS)[number]['id'];

export function normalizeThemePreset(
  value: string | null | undefined,
): ValidThemePreset {
  const match = LIST_THEME_PRESETS.find((preset) => preset.id === value);
  return match ? match.id : 'classic';
}

export function getInitials(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  const lastWord = words.length > 1 ? words[words.length - 1] : '';

  const firstGrapheme = (word: string) => {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter('es', { granularity: 'grapheme' });
      const first = seg.segment(word)[Symbol.iterator]().next().value;
      return first ? first.segment : '';
    }
    return Array.from(word)[0] ?? '';
  };

  return (
    firstGrapheme(firstWord) + (lastWord ? firstGrapheme(lastWord) : '')
  ).toUpperCase();
}

export function formatMoney(
  amount: number | null | undefined,
  currency = 'MXN',
): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return null;
  }
  const code = (currency || 'MXN').trim().toUpperCase();
  try {
    const formatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
    return `${formatted} ${code}`;
  } catch {
    return `${amount} ${code}`;
  }
}

export function parseOptionalAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return parsed;
}

export function formatEventDate(
  eventDate: string | null | undefined,
): string | null {
  if (!eventDate) return null;
  const match = ISO_DATE_REGEX.exec(eventDate.trim());
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

export function formatCountdown(
  eventDate: string | null | undefined,
  today = new Date(),
): string | null {
  if (!eventDate) return null;
  const match = ISO_DATE_REGEX.exec(eventDate.trim());
  if (!match) return null;

  const targetUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const diffDays = Math.round((targetUtc - todayUtc) / 86_400_000);

  if (diffDays === 0) return 'Hoy es el evento';
  if (diffDays === 1) return 'Falta 1 día';
  if (diffDays > 1) return `Faltan ${diffDays} días`;
  if (diffDays === -1) return 'Fue ayer';
  return `Hace ${Math.abs(diffDays)} días`;
}
