import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pool from '../db/pool.js';

export function configurePassport() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
    throw new Error(
      'Brak wymaganych zmiennych Google OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL).'
    );
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const displayName = profile.displayName || email || 'Użytkownik';

          if (!email) {
            return done(new Error('Konto Google nie udostępniło adresu e-mail.'));
          }

          const { rows } = await pool.query(
            `
            INSERT INTO users (google_id, email, display_name)
            VALUES ($1, $2, $3)
            ON CONFLICT (google_id)
            DO UPDATE SET
              email = EXCLUDED.email,
              display_name = EXCLUDED.display_name
            RETURNING id, google_id, email, display_name, created_at
            `,
            [googleId, email, displayName]
          );

          return done(null, rows[0]);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const { rows } = await pool.query(
        'SELECT id, google_id, email, display_name, created_at FROM users WHERE id = $1',
        [id]
      );
      if (rows.length === 0) {
        return done(null, false);
      }
      return done(null, rows[0]);
    } catch (err) {
      return done(err);
    }
  });
}
