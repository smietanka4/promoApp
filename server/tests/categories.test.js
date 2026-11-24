import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, isValidCategory, normalizeCategory } from '../constants/categories.js';

test('zawiera dokładnie 8 predefiniowanych kategorii', () => {
  assert.equal(CATEGORIES.length, 8);
  assert.ok(CATEGORIES.includes('Napoje'));
  assert.ok(CATEGORIES.includes('Nabiał'));
  assert.ok(CATEGORIES.includes('Chemia i kosmetyki'));
  assert.ok(CATEGORIES.includes('Inne'));
});

test('isValidCategory poprawnie waliduje kategorie', () => {
  assert.equal(isValidCategory('Warzywa i owoce'), true);
  assert.equal(isValidCategory('Nieistniejąca'), false);
  assert.equal(isValidCategory(null), false);
});

test('normalizeCategory zwraca "Inne" dla nieznanych wartości', () => {
  assert.equal(normalizeCategory('Pieczywo'), 'Pieczywo');
  assert.equal(normalizeCategory('Alkohol'), 'Inne');
  assert.equal(normalizeCategory(undefined), 'Inne');
});
