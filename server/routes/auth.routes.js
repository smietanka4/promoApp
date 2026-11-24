import { Router } from 'express';
import passport from 'passport';

const router = Router();

const getClientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

// Inicjacja logowania Google OAuth 2.0
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

// Callback z Google OAuth 2.0
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${getClientUrl()}/?auth_error=google_failed`,
  }),
  (_req, res) => {
    res.redirect(getClientUrl());
  }
);

// Pobranie aktualnie zalogowanego użytkownika (weryfikacja sesji PWA)
router.get('/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    return res.status(200).json({ authenticated: false, user: null });
  }
  return res.status(200).json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      display_name: req.user.display_name,
    },
  });
});

// Wylogowanie i usunięcie sesji z PostgreSQL
router.post('/logout', (req, res, next) => {
  req.logout((logoutErr) => {
    if (logoutErr) {
      return next(logoutErr);
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        return next(destroyErr);
      }
      res.clearCookie('promoapp.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      return res.status(200).json({ ok: true });
    });
  });
});

export default router;
