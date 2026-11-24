export const CATEGORIES = [
  'Napoje',
  'Nabiał',
  'Pieczywo',
  'Mięso i ryby',
  'Warzywa i owoce',
  'Słodycze i przekąski',
  'Chemia i kosmetyki',
  'Inne',
];

const CATEGORY_SET = new Set(CATEGORIES);

export function isValidCategory(category) {
  return typeof category === 'string' && CATEGORY_SET.has(category);
}

export function normalizeCategory(category) {
  return isValidCategory(category) ? category : 'Inne';
}
