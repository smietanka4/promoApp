import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { CATEGORIES } from '../constants/categories.js';

const router = Router();

router.use(requireAuth);

function getCurrentMonthWarsaw() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
}

function getMonthRange(monthParam) {
  const raw = typeof monthParam === 'string' && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : getCurrentMonthWarsaw();

  const [yearStr, monthStr] = raw.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);

  if (monthNum < 1 || monthNum > 12) {
    return getMonthRange(getCurrentMonthWarsaw());
  }

  const startDate = `${yearStr}-${monthStr}-01`;
  const nextYear = monthNum === 12 ? year + 1 : year;
  const nextMonth = monthNum === 12 ? '01' : String(monthNum + 1).padStart(2, '0');
  const endDate = `${nextYear}-${nextMonth}-01`;

  return { month: raw, startDate, endDate };
}

// Podsumowanie miesięczne: wydane vs zaoszczędzone + rozbicie na kategorie
router.get('/summary', async (req, res, next) => {
  try {
    const { month, startDate, endDate } = getMonthRange(req.query.month);

    const [totalsResult, categoriesResult, recentResult] = await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*)::int AS receipt_count,
          COALESCE(SUM(total_paid), 0)::float8 AS total_paid,
          COALESCE(SUM(total_saved), 0)::float8 AS total_saved
        FROM receipts
        WHERE user_id = $1
          AND receipt_date >= $2
          AND receipt_date < $3
        `,
        [req.user.id, startDate, endDate]
      ),
      pool.query(
        `
        SELECT
          ri.category,
          COALESCE(SUM(ri.paid_amount), 0)::float8 AS paid_amount,
          COALESCE(SUM(ri.discount_amount), 0)::float8 AS discount_amount,
          COUNT(ri.id)::int AS item_count
        FROM receipt_items ri
        INNER JOIN receipts r ON r.id = ri.receipt_id
        WHERE r.user_id = $1
          AND r.receipt_date >= $2
          AND r.receipt_date < $3
        GROUP BY ri.category
        `,
        [req.user.id, startDate, endDate]
      ),
      pool.query(
        `
        SELECT
          id,
          store_name,
          to_char(receipt_date, 'YYYY-MM-DD') AS receipt_date,
          total_paid::float8 AS total_paid,
          total_saved::float8 AS total_saved
        FROM receipts
        WHERE user_id = $1
          AND receipt_date >= $2
          AND receipt_date < $3
        ORDER BY receipt_date DESC, created_at DESC
        LIMIT 10
        `,
        [req.user.id, startDate, endDate]
      ),
    ]);

    const totals = totalsResult.rows[0];
    const totalPaid = Math.round(totals.total_paid * 100) / 100;
    const totalSaved = Math.round(totals.total_saved * 100) / 100;
    const totalBeforeDiscount = Math.round((totalPaid + totalSaved) * 100) / 100;
    const savingsPercent =
      totalBeforeDiscount > 0
        ? Math.round((totalSaved / totalBeforeDiscount) * 1000) / 10
        : 0;

    const categoryMap = new Map(
      categoriesResult.rows.map((row) => [
        row.category,
        {
          category: row.category,
          paid_amount: Math.round(row.paid_amount * 100) / 100,
          discount_amount: Math.round(row.discount_amount * 100) / 100,
          item_count: row.item_count,
        },
      ])
    );

    const byCategory = CATEGORIES.map(
      (cat) =>
        categoryMap.get(cat) || {
          category: cat,
          paid_amount: 0,
          discount_amount: 0,
          item_count: 0,
        }
    ).sort((a, b) => b.discount_amount - a.discount_amount || b.paid_amount - a.paid_amount);

    return res.status(200).json({
      month,
      receipt_count: totals.receipt_count,
      total_paid: totalPaid,
      total_saved: totalSaved,
      total_before_discount: totalBeforeDiscount,
      savings_percent: savingsPercent,
      by_category: byCategory,
      recent_receipts: recentResult.rows,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
