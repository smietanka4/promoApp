import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { CATEGORIES, formatPLN } from '../constants/categories.js';
import { saveReceipt } from '../api/client.js';

function createEmptyItem() {
  return {
    _key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    category: 'Inne',
    quantity: '1',
    paid_amount: '0',
    discount_amount: '0',
  };
}

export default function ReceiptReview({ scanResult, onCancel, onSaved }) {
  const initialReceipt = scanResult.receipt;

  const [storeName, setStoreName] = useState(initialReceipt.store_name || '');
  const [receiptDate, setReceiptDate] = useState(initialReceipt.receipt_date || '');
  const [items, setItems] = useState(() =>
    (initialReceipt.items || []).map((item, idx) => ({
      _key: `item-${idx}-${Date.now()}`,
      name: item.name ?? '',
      category: CATEGORIES.includes(item.category) ? item.category : 'Inne',
      quantity: String(item.quantity ?? 1),
      paid_amount: String(item.paid_amount ?? 0),
      discount_amount: String(item.discount_amount ?? 0),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const totals = useMemo(() => {
    const paid = items.reduce((sum, item) => sum + (Math.max(0, Number(item.paid_amount)) || 0), 0);
    const saved = items.reduce(
      (sum, item) => sum + (Math.max(0, Number(item.discount_amount)) || 0),
      0
    );
    return {
      paid: Math.round(paid * 100) / 100,
      saved: Math.round(saved * 100) / 100,
    };
  }, [items]);

  function updateItem(key, field, value) {
    setItems((prev) =>
      prev.map((item) => (item._key === key ? { ...item, [field]: value } : item))
    );
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((item) => item._key !== key));
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!storeName.trim()) {
      setError('Podaj nazwę sklepu.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
      setError('Podaj poprawną datę paragonu.');
      return;
    }
    if (items.length === 0) {
      setError('Dodaj co najmniej jeden produkt.');
      return;
    }

    const preparedItems = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item.name.trim()) {
        setError(`Pozycja #${i + 1}: wpisz nazwę produktu.`);
        return;
      }
      const quantity = Number(String(item.quantity).replace(',', '.'));
      const paidAmount = Number(String(item.paid_amount).replace(',', '.'));
      const discountAmount = Number(String(item.discount_amount || '0').replace(',', '.'));

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError(`Pozycja #${i + 1}: ilość musi być większa od zera.`);
        return;
      }
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        setError(`Pozycja #${i + 1}: nieprawidłowa kwota zapłacona.`);
        return;
      }
      if (!Number.isFinite(discountAmount) || discountAmount < 0) {
        setError(`Pozycja #${i + 1}: nieprawidłowa kwota rabatu.`);
        return;
      }

      preparedItems.push({
        name: item.name.trim(),
        category: item.category,
        quantity,
        paid_amount: paidAmount,
        discount_amount: discountAmount,
      });
    }

    try {
      setSaving(true);
      const data = await saveReceipt({
        store_name: storeName.trim(),
        receipt_date: receiptDate,
        items: preparedItems,
        raw_ai_response: scanResult.raw_ai_response ?? null,
      });
      onSaved(data.receipt);
    } catch (err) {
      setError(err.message || 'Nie udało się zapisać paragonu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-28">
      {/* Nagłówek */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Wróć
          </button>
          <h1 className="text-base font-bold text-slate-900">Sprawdź paragon</h1>
          <span className="text-xs font-medium text-slate-500">{items.length} poz.</span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Podsumowanie na żywo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-600 text-white p-3.5 shadow-sm">
            <p className="text-xs text-emerald-100 font-medium">Zaoszczędzono</p>
            <p className="text-2xl font-extrabold mt-0.5">{formatPLN(totals.saved)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-3.5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">Zapłacono łącznie</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{formatPLN(totals.paid)}</p>
          </div>
        </div>

        {/* Dane sklepu i data */}
        <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Sklep</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="np. Biedronka"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Data zakupu</label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Lista pozycji do szybkiej korekty */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-700">Rozpoznane produkty</h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Dodaj pozycję
            </button>
          </div>

          {items.map((item) => (
            <div
              key={item._key}
              className="rounded-2xl bg-white border border-slate-200 p-3.5 shadow-sm space-y-2.5"
            >
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(item._key, 'name', e.target.value)}
                  placeholder="Nazwa produktu"
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item._key)}
                  aria-label="Usuń pozycję"
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    Kategoria
                  </label>
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(item._key, 'category', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    Ilość
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={item.quantity}
                    onChange={(e) => updateItem(item._key, 'quantity', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                    Zapłacono (zł)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={item.paid_amount}
                    onChange={(e) => updateItem(item._key, 'paid_amount', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-emerald-700 mb-0.5">
                    Rabat / oszczędność (zł)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={item.discount_amount}
                    onChange={(e) => updateItem(item._key, 'discount_amount', e.target.value)}
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-50/60 px-2.5 py-1.5 text-sm font-semibold text-emerald-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dolny pasek akcji */}
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-slate-200 px-4 pt-3 safe-bottom">
          <div className="max-w-lg mx-auto flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-2xl border border-slate-300 bg-white py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Zapisz paragon
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
