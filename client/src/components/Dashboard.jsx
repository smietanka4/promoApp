import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Receipt,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { deleteReceipt, getDashboardSummary } from '../api/client.js';
import { CATEGORY_META, formatPLN } from '../constants/categories.js';
import ScanButton from './ScanButton.jsx';

function getCurrentMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  const label = new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function Dashboard({ user, onLogout, onReceiptScanned, refreshToken }) {
  const [month, setMonth] = useState(getCurrentMonthKey);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardSummary(month);
      setSummary(data);
    } catch (err) {
      setError(err.message || 'Nie udało się pobrać podsumowania.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshToken]);

  async function handleDelete(receiptId) {
    if (!window.confirm('Usunąć ten paragon z historii?')) return;
    try {
      setDeletingId(receiptId);
      await deleteReceipt(receiptId);
      await loadSummary();
    } catch (err) {
      setError(err.message || 'Nie udało się usunąć paragonu.');
    } finally {
      setDeletingId(null);
    }
  }

  const firstName = (user?.display_name || 'Użytkowniku').split(' ')[0];
  const currentMonthKey = getCurrentMonthKey();

  return (
    <div className="min-h-dvh bg-slate-50 pb-28">
      {/* Górny pasek */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-700">PromoApp</p>
            <h1 className="text-base font-bold text-slate-900">Cześć, {firstName}</h1>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Wyloguj się"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Wyloguj
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        {/* Wybór miesiąca */}
        <div className="flex items-center justify-between rounded-2xl bg-white border border-slate-200 px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => setMonth((prev) => shiftMonth(prev, -1))}
            aria-label="Poprzedni miesiąc"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-slate-900">{formatMonthLabel(month)}</span>
          <button
            type="button"
            disabled={month >= currentMonthKey}
            onClick={() => setMonth((prev) => shiftMonth(prev, 1))}
            aria-label="Następny miesiąc"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Karta Hero: Oszczędności na pierwszym planie */}
        <section className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white p-5 shadow-lg shadow-emerald-600/20">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100">
              <Sparkles className="w-3.5 h-3.5" />
              Zaoszczędzone na promocjach
            </span>
            {summary && summary.savings_percent > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                <TrendingUp className="w-3.5 h-3.5" />-{summary.savings_percent}%
              </span>
            )}
          </div>

          {loading ? (
            <div className="mt-3 h-10 w-44 rounded-xl bg-white/20 animate-pulse" />
          ) : (
            <p className="mt-2 text-4xl font-extrabold tracking-tight">
              {formatPLN(summary?.total_saved ?? 0)}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-white/15">
            <div>
              <p className="text-xs text-emerald-100/85">Wydano łącznie</p>
              <p className="text-lg font-bold mt-0.5">
                {loading ? '...' : formatPLN(summary?.total_paid ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-emerald-100/85">Zeskanowane paragony</p>
              <p className="text-lg font-bold mt-0.5">
                {loading ? '...' : summary?.receipt_count ?? 0}
              </p>
            </div>
          </div>
        </section>

        {/* Rozbicie na kategorie */}
        <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Rozbicie na kategorie</h2>
            <span className="text-xs text-slate-500">Zaoszczędzone / Wydane</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(summary?.by_category || []).map((cat) => {
                const meta = CATEGORY_META[cat.category] || CATEGORY_META.Inne;
                const gross = cat.paid_amount + cat.discount_amount;
                const savedRatio = gross > 0 ? Math.min(100, Math.round((cat.discount_amount / gross) * 100)) : 0;

                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none">{meta.emoji}</span>
                        <span className="font-medium text-slate-800 truncate">{cat.category}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-bold text-emerald-600">
                          +{formatPLN(cat.discount_amount)}
                        </span>
                        <span className="text-xs text-slate-400 mx-1">/</span>
                        <span className="text-xs font-medium text-slate-600">
                          {formatPLN(cat.paid_amount)}
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${savedRatio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Ostatnie paragony w miesiącu */}
        <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Paragony w tym miesiącu</h2>
          </div>

          {!loading && (!summary?.recent_receipts || summary.recent_receipts.length === 0) ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              Brak paragonów w wybranym miesiącu. Kliknij poniżej, aby zeskanować pierwszy!
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(summary?.recent_receipts || []).map((receipt) => (
                <li
                  key={receipt.id}
                  className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-1"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {receipt.store_name}
                    </p>
                    <p className="text-xs text-slate-500">{receipt.receipt_date}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-600">
                        +{formatPLN(receipt.total_saved)}
                      </p>
                      <p className="text-xs text-slate-500">{formatPLN(receipt.total_paid)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === receipt.id}
                      onClick={() => handleDelete(receipt.id)}
                      aria-label="Usuń paragon"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Stały przycisk skanowania u dołu ekranu (Mobile-First) */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white/90 backdrop-blur border-t border-slate-200 px-4 pt-3 safe-bottom">
        <div className="max-w-lg mx-auto">
          <ScanButton onScanned={onReceiptScanned} onError={(msg) => setError(msg)} />
        </div>
      </div>
    </div>
  );
}
