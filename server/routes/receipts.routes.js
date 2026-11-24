import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { receiptUpload } from '../middleware/upload.js';
import { analyzeReceiptImage } from '../services/geminiReceiptService.js';
import { isValidCategory } from '../constants/categories.js';

const router = Router();

router.use(requireAuth);

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function round3(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function validateReceiptPayload(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Brak danych paragonu.' };
  }

  const storeName = typeof body.store_name === 'string' ? body.store_name.trim() : '';
  if (!storeName || storeName.length > 255) {
    return { error: 'Podaj poprawną nazwę sklepu (1–255 znaków).' };
  }

  const receiptDate = typeof body.receipt_date === 'string' ? body.receipt_date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate) || Number.isNaN(Date.parse(`${receiptDate}T00:00:00Z`))) {
    return { error: 'Podaj poprawną datę paragonu w formacie YYYY-MM-DD.' };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: 'Paragon musi zawierać co najmniej jedną pozycję.' };
  }

  const validatedItems = [];
  for (let i = 0; i < body.items.length; i += 1) {
    const raw = body.items[i];
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (!name || name.length > 255) {
      return { error: `Pozycja #${i + 1}: nazwa produktu jest wymagana.` };
    }

    if (!isValidCategory(raw.category)) {
      return { error: `Pozycja #${i + 1}: nieprawidłowa kategoria "${raw.category}".` };
    }

    const quantity = Number(raw.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Pozycja #${i + 1}: ilość musi być liczbą dodatnią.` };
    }

    const paidAmount = Number(raw.paid_amount);
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      return { error: `Pozycja #${i + 1}: kwota zapłacona musi być liczbą >= 0.` };
    }

    const discountAmount = Number(raw.discount_amount ?? 0);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return { error: `Pozycja #${i + 1}: kwota rabatu musi być liczbą >= 0.` };
    }

    validatedItems.push({
      name,
      category: raw.category,
      quantity: round3(quantity),
      paid_amount: round2(paidAmount),
      discount_amount: round2(discountAmount),
    });
  }

  const totalPaid = round2(validatedItems.reduce((sum, item) => sum + item.paid_amount, 0));
  const totalSaved = round2(validatedItems.reduce((sum, item) => sum + item.discount_amount, 0));

  return {
    data: {
      store_name: storeName,
      receipt_date: receiptDate,
      total_paid: totalPaid,
      total_saved: totalSaved,
      raw_ai_response: body.raw_ai_response ?? null,
      items: validatedItems,
    },
  };
}

// 1. Analyze receipt image with Gemini (not persisted yet - Human-in-the-loop)
router.post('/scan', receiptUpload.single('receipt'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Nie przesłano zdjęcia paragonu (wymagane pole formularza: "receipt").',
      });
    }

    const result = await analyzeReceiptImage(req.file.buffer, req.file.mimetype);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// 2. Persist verified receipt and items inside a PostgreSQL transaction
router.post('/', async (req, res, next) => {
  const { error, data } = validateReceiptPayload(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const receiptResult = await client.query(
      `
      INSERT INTO receipts (user_id, store_name, receipt_date, total_paid, total_saved, raw_ai_response)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, store_name, to_char(receipt_date, 'YYYY-MM-DD') AS receipt_date,
                total_paid::float8 AS total_paid, total_saved::float8 AS total_saved, created_at
      `,
      [
        req.user.id,
        data.store_name,
        data.receipt_date,
        data.total_paid,
        data.total_saved,
        data.raw_ai_response ? JSON.stringify(data.raw_ai_response) : null,
      ]
    );

    const savedReceipt = receiptResult.rows[0];
    const savedItems = [];

    for (const item of data.items) {
      const itemResult = await client.query(
        `
        INSERT INTO receipt_items (receipt_id, name, category, quantity, paid_amount, discount_amount)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, receipt_id, name, category,
                  quantity::float8 AS quantity,
                  paid_amount::float8 AS paid_amount,
                  discount_amount::float8 AS discount_amount
        `,
        [
          savedReceipt.id,
          item.name,
          item.category,
          item.quantity,
          item.paid_amount,
          item.discount_amount,
        ]
      );
      savedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      receipt: {
        ...savedReceipt,
        items: savedItems,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return next(err);
  } finally {
    client.release();
  }
});

// 3. List user receipts (optional ?month=YYYY-MM filter)
router.get('/', async (req, res, next) => {
  try {
    const { month } = req.query;
    const params = [req.user.id];
    let dateFilterSql = '';

    if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const monthNum = Number(monthStr);
      if (monthNum >= 1 && monthNum <= 12) {
        const startDate = `${yearStr}-${monthStr}-01`;
        const nextYear = monthNum === 12 ? year + 1 : year;
        const nextMonth = monthNum === 12 ? '01' : String(monthNum + 1).padStart(2, '0');
        const endDate = `${nextYear}-${nextMonth}-01`;
        params.push(startDate, endDate);
        dateFilterSql = 'AND r.receipt_date >= $2 AND r.receipt_date < $3';
      }
    }

    const { rows } = await pool.query(
      `
      SELECT
        r.id,
        r.store_name,
        to_char(r.receipt_date, 'YYYY-MM-DD') AS receipt_date,
        r.total_paid::float8 AS total_paid,
        r.total_saved::float8 AS total_saved,
        r.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'name', ri.name,
              'category', ri.category,
              'quantity', ri.quantity::float8,
              'paid_amount', ri.paid_amount::float8,
              'discount_amount', ri.discount_amount::float8
            ) ORDER BY ri.id
          ) FILTER (WHERE ri.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM receipts r
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      WHERE r.user_id = $1
        ${dateFilterSql}
      GROUP BY r.id
      ORDER BY r.receipt_date DESC, r.created_at DESC
      LIMIT 100
      `,
      params
    );

    return res.status(200).json({ receipts: rows });
  } catch (err) {
    return next(err);
  }
});

// 4. Delete a receipt owned by the authenticated user
router.delete('/:id', async (req, res, next) => {
  try {
    const receiptId = Number(req.params.id);
    if (!Number.isInteger(receiptId) || receiptId <= 0) {
      return res.status(400).json({ error: 'Nieprawidłowy identyfikator paragonu.' });
    }

    const { rowCount } = await pool.query(
      'DELETE FROM receipts WHERE id = $1 AND user_id = $2',
      [receiptId, req.user.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Nie znaleziono paragonu.' });
    }

    return res.status(200).json({ deleted: true, id: receiptId });
  } catch (err) {
    return next(err);
  }
});

export default router;
