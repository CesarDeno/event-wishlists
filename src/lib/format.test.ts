import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCompactUrl,
  formatCountdown,
  formatEventDate,
  formatMoney,
  getHostnameLabel,
  getInitials,
  isSafeHttpUrl,
  isValidSlug,
  normalizeThemePreset,
  parseOptionalAmount,
  slugify,
} from './format.ts';

describe('slug utilities', () => {
  it('validates lowercase slugs with hyphens', () => {
    assert.equal(isValidSlug('navidad-2026'), true);
    assert.equal(isValidSlug('intercambio'), true);
    assert.equal(isValidSlug('Navidad'), false);
    assert.equal(isValidSlug('mi--lista'), false);
    assert.equal(isValidSlug('-lista'), false);
    assert.equal(isValidSlug('lista-'), false);
    assert.equal(isValidSlug('mi lista'), false);
  });

  it('slugifies accented Spanish titles', () => {
    assert.equal(slugify('Intercambio de Oficina 2026!'), 'intercambio-de-oficina-2026');
    assert.equal(slugify('  Cumpleaños de Sofía  '), 'cumpleanos-de-sofia');
  });
});

describe('URL and amount helpers', () => {
  it('allows only http and https URLs', () => {
    assert.equal(isSafeHttpUrl('https://tienda.com/producto'), true);
    assert.equal(isSafeHttpUrl('http://tienda.com/producto'), true);
    assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
    assert.equal(isSafeHttpUrl('tienda.com/producto'), false);
  });

  it('extracts clean store hostname without www', () => {
    assert.equal(
      getHostnameLabel('https://www.amazon.com.mx/dp/B001'),
      'amazon.com.mx',
    );
    assert.equal(getHostnameLabel('javascript:alert(1)'), null);
  });

  it('formats compact URL without protocol, www, or query params', () => {
    assert.equal(
      formatCompactUrl('https://www.amazon.com.mx/dp/B08W2C5W59?ref=sr_1_6'),
      'amazon.com.mx/dp/B08W2C5W59',
    );
    assert.equal(formatCompactUrl('https://tienda.com/'), 'tienda.com');
    assert.equal(formatCompactUrl('javascript:alert(1)'), null);
  });

  it('parses optional amounts cleanly', () => {
    assert.equal(parseOptionalAmount(''), null);
    assert.equal(parseOptionalAmount('  '), null);
    assert.equal(parseOptionalAmount('450.5'), 450.5);
    assert.ok(Number.isNaN(parseOptionalAmount('-10')));
    assert.ok(Number.isNaN(parseOptionalAmount('abc')));
  });

  it('formats money with currency code and handles unknown currency', () => {
    assert.equal(formatMoney(null, 'MXN'), null);
    assert.match(formatMoney(500, 'MXN') ?? '', /500.*MXN/);
    assert.equal(formatMoney(100, 'INVALID'), '100 INVALID');
  });

  it('formats event countdown accurately across local dates', () => {
    const base = new Date(2026, 10, 11); // 11 nov 2026 local
    assert.equal(formatCountdown('2026-11-11', base), 'Hoy es el evento');
    assert.equal(formatCountdown('2026-11-12', base), 'Falta 1 día');
    assert.equal(formatCountdown('2026-11-23', base), 'Faltan 12 días');
    assert.equal(formatCountdown('2026-11-10', base), 'Fue ayer');
    assert.equal(formatCountdown('2026-11-08', base), 'Hace 3 días');
    assert.ok(formatEventDate('2026-12-24'));
  });

  it('computes initials and normalizes theme presets safely', () => {
    assert.equal(getInitials('Cesar Denogean'), 'CD');
    assert.equal(getInitials('Sofía'), 'S');
    assert.equal(getInitials(''), '?');
    assert.equal(normalizeThemePreset('festive'), 'festive');
    assert.equal(normalizeThemePreset('rose'), 'rose');
    assert.equal(normalizeThemePreset('lavender'), 'lavender');
    assert.equal(normalizeThemePreset('ocean'), 'ocean');
    assert.equal(normalizeThemePreset('slate'), 'slate');
    assert.equal(normalizeThemePreset('sunset'), 'sunset');
    assert.equal(normalizeThemePreset('matcha'), 'matcha');
    assert.equal(normalizeThemePreset('indigo'), 'indigo');
    assert.equal(normalizeThemePreset('github'), 'github');
    assert.equal(normalizeThemePreset('unknown'), 'classic');
  });
});
