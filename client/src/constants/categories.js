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

export const CATEGORY_META = {
  Napoje: { emoji: '🥤', badgeClass: 'bg-sky-100 text-sky-800' },
  Nabiał: { emoji: '🧀', badgeClass: 'bg-amber-100 text-amber-800' },
  Pieczywo: { emoji: '🥖', badgeClass: 'bg-orange-100 text-orange-800' },
  'Mięso i ryby': { emoji: '🥩', badgeClass: 'bg-rose-100 text-rose-800' },
  'Warzywa i owoce': { emoji: '🥦', badgeClass: 'bg-emerald-100 text-emerald-800' },
  'Słodycze i przekąski': { emoji: '🍫', badgeClass: 'bg-purple-100 text-purple-800' },
  'Chemia i kosmetyki': { emoji: '🧴', badgeClass: 'bg-cyan-100 text-cyan-800' },
  Inne: { emoji: '🛒', badgeClass: 'bg-slate-100 text-slate-700' },
};

export function formatPLN(amount) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}
