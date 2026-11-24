import { Router } from 'express';
import passport from 'passport';

const router = Router();

const getClientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';

// Initiate Google OAuth 2.0 login
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

// Google OAuth 2.0 callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${getClientUrl()}/?auth_error=google_failed`,
  }),
  (_req, res) => {
    res.redirect(getClientUrl());
  }
);

// Return currently authenticated user (PWA session check)
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

// Log out and destroy session in PostgreSQL
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
