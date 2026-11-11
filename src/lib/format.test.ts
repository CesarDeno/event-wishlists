import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMoney,
  isSafeHttpUrl,
  isValidSlug,
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
});

