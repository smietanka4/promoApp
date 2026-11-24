import { GoogleGenAI, Type } from '@google/genai';
import { CATEGORIES, normalizeCategory } from '../constants/categories.js';

let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Brak zmiennej środowiskowej GEMINI_API_KEY.');
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

const receiptResponseSchema = {
  type: Type.OBJECT,
  properties: {
    store_name: {
      type: Type.STRING,
      description:
        'Czytelna nazwa sieci lub sklepu (np. "Biedronka", "Lidl", "Dino", "Żabka", "Auchan", "Rossmann"). Jeśli nieczytelna, wpisz "Nieznany sklep".',
    },
    receipt_date: {
      type: Type.STRING,
      description:
        'Data zakupu z paragonu w formacie YYYY-MM-DD. Jeśli nieczytelna, zwróć pusty ciąg znaków.',
    },
    items: {
      type: Type.ARRAY,
      description:
        'Lista wszystkich produktów z paragonu z przypisanymi rabatami (bez osobnych linii samych rabatów).',
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description:
              'Rozwinięta, czytelna polska nazwa produktu (rozszyfruj skróty z paragonu, np. "WODA NGZ POL 1,5L" -> "Woda niegazowana Polaris 1,5L").',
          },
          category: {
            type: Type.STRING,
            enum: CATEGORIES,
            description: 'Jedna z predefiniowanych kategorii zakupowych.',
          },
          quantity: {
            type: Type.NUMBER,
            description:
              'Ilość sztuk lub waga w kg (liczba dodatnia, np. 1, 2, 12, 0.456). Domyślnie 1.',
          },
          paid_amount: {
            type: Type.NUMBER,
            description:
              'Ostateczna kwota w PLN FAKTYCZNIE ZAPŁACONA za tę pozycję PO odjęciu rabatu (wartość >= 0). Suma paid_amount wszystkich pozycji powinna odpowiadać kwocie SUMA PLN na paragonie.',
          },
          discount_amount: {
            type: Type.NUMBER,
            description:
              'Kwota zaoszczędzona na tej pozycji dzięki promocji/rabatowi w PLN jako liczba DODATNIA (>= 0). Jeśli brak rabatu, wpisz 0.',
          },
        },
        required: ['name', 'category', 'quantity', 'paid_amount', 'discount_amount'],
      },
    },
  },
  required: ['store_name', 'receipt_date', 'items'],
};

const RECEIPT_SYSTEM_PROMPT = `Jesteś ekspertem od analizy polskich paragonów fiskalnych (Biedronka, Lidl, Dino, Kaufland, Auchan, Carrefour, Żabka, Netto, Rossmann itp.).
Twoim zadaniem jest dokładne wyodrębnienie wszystkich zakupionych produktów oraz przypisanie im rabatów z promocji.

Zasady analizy:
1. Rozszyfruj enigmatyczne skróty nazw produktów na czytelne polskie nazwy (np. "WODA NGZ POL 1,5L" -> "Woda niegazowana Polaris 1,5L", "SER ZOLTY GOUDA PL" -> "Ser żółty Gouda plastry").
2. Linii rabatów/opustów/promocji (np. "RABAT -4,99", "OPUST", "6+6 GRATIS", "Lidl Plus", "Moja Biedronka") NIE dodawaj jako osobnych pozycji na liście items. Zamiast tego:
   - przypisz kwotę rabatu jako wartość DODATNIĄ w polu "discount_amount" odpowiedniego produktu,
   - pomniejsz pole "paid_amount" tego produktu o ten rabat, tak aby "paid_amount" oznaczało faktycznie zapłaconą kwotę końcową.
3. Jeśli na dole paragonu znajduje się zbiorczy rabat dla konkretnego produktu, dopasuj go do właściwej pozycji. Jeśli jest to rabat na cały koszyk (np. voucher -10 zł), rozdziel go proporcjonalnie na pozycje tak, aby żadna pozycja nie miała ujemnej kwoty paid_amount.
4. Każdą pozycję przypisz dokładnie do jednej z dozwolonych kategorii: ${CATEGORIES.join(', ')}.
5. Pomiń kaucje/reklamówki tylko wtedy, gdy nie są produktem – w przeciwnym razie zaklasyfikuj reklamówki do kategorii "Inne".
6. Wszystkie kwoty podaj w PLN jako liczby dziesiętne (z kropką w JSON, maksymalnie 2 miejsca po przecinku).`;

function round2(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
}

function round3(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.round(num * 1000) / 1000;
}

function getTodayWarsaw() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizeDate(dateStr) {
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const parsed = new Date(`${dateStr.trim()}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return dateStr.trim();
    }
  }
  return getTodayWarsaw();
}

export async function analyzeReceiptImage(imageBuffer, mimeType) {
  const ai = getAiClient();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        inlineData: {
          mimeType,
          data: imageBuffer.toString('base64'),
        },
      },
      {
        text: 'Przeanalizuj ten polski paragon i zwróć ustrukturyzowane dane JSON zgodnie ze schematem.',
      },
    ],
    config: {
      systemInstruction: RECEIPT_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: receiptResponseSchema,
      temperature: 0.1,
    },
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error('Model AI zwrócił pustą odpowiedź. Spróbuj zrobić wyraźniejsze zdjęcie paragonu.');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Nie udało się sparsować odpowiedzi JSON z modelu AI.');
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .filter((item) => item && typeof item.name === 'string' && item.name.trim().length > 0)
    .map((item) => ({
      name: item.name.trim().slice(0, 255),
      category: normalizeCategory(item.category),
      quantity: round3(item.quantity),
      paid_amount: round2(item.paid_amount),
      discount_amount: round2(item.discount_amount),
    }));

  const totalPaid = round2(items.reduce((sum, item) => sum + item.paid_amount, 0));
  const totalSaved = round2(items.reduce((sum, item) => sum + item.discount_amount, 0));

  const storeName =
    typeof parsed.store_name === 'string' && parsed.store_name.trim().length > 0
      ? parsed.store_name.trim().slice(0, 255)
      : 'Nieznany sklep';

  return {
    receipt: {
      store_name: storeName,
      receipt_date: normalizeDate(parsed.receipt_date),
      total_paid: totalPaid,
      total_saved: totalSaved,
      items,
    },
    raw_ai_response: parsed,
  };
}
