import './config/env.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from 'passport';
import multer from 'multer';

import pool from './db/pool.js';
import { configurePassport } from './config/passport.js';
import authRoutes from './routes/auth.routes.js';
import receiptsRoutes from './routes/receipts.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dni

if (!process.env.SESSION_SECRET) {
  throw new Error('Brak zmiennej środowiskowej SESSION_SECRET.');
}

// Niezbędne za reverse proxy (Nginx, Render, Railway, Cloudflare), aby ciasteczka secure działały poprawnie
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));

// Magazyn sesji w PostgreSQL (tabela "session")
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      pruneSessionInterval: 60 * 60, // Czyszczenie wygasłych sesji co godzinę
    }),
    name: 'promoapp.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Odświeża 30-dniowy czas życia sesji przy aktywności użytkownika w PWA
    proxy: isProd,
    cookie: {
      maxAge: SESSION_MAX_AGE_MS,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
    },
  })
);

// Konfiguracja Passport.js (Google OAuth 2.0)
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Endpoint kontrolny (healthcheck)
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Routing API
app.use('/api/auth', authRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serwowanie zbudowanego frontendu PWA na produkcji (opcjonalny tryb single-service)
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (isProd && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Obsługa nieznanych endpointów API
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Nie znaleziono zasobu API.' });
});

// Globalny handler błędów (w tym błędów Multera)
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Zdjęcie jest zbyt duże (maksymalny rozmiar to 10 MB).',
      });
    }
    return res.status(400).json({ error: `Błąd przesyłania pliku: ${err.message}` });
  }

  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) {
    console.error('[Server Error]', err);
  }

  return res.status(statusCode).json({
    error: statusCode >= 500 && isProd
      ? 'Wystąpił wewnętrzny błąd serwera.'
      : err.message || 'Wystąpił nieoczekiwany błąd.',
  });
});

app.listen(PORT, () => {
  console.log(`[PromoApp Server] Działa na porcie ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
});
