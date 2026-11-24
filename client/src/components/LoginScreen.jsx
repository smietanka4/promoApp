import { Sparkles, Camera, PiggyBank } from 'lucide-react';
import { GOOGLE_AUTH_URL } from '../api/client.js';

export default function LoginScreen({ authError }) {
  return (
    <div className="min-h-dvh flex flex-col justify-between bg-gradient-to-b from-emerald-600 via-emerald-700 to-slate-900 text-white px-5 py-10">
      <div className="max-w-md w-full mx-auto pt-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-medium backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
          Koniec z demotywującym liczeniem wydatków
        </div>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight leading-tight">
          Zobacz, ile <span className="text-emerald-200">zaoszczędziłeś</span> na promocjach
        </h1>

        <p className="mt-4 text-emerald-50/90 text-base leading-relaxed">
          Zrób zdjęcie paragonu z Biedronki, Lidla czy Dino. AI rozszyfruje skróty produktów,
          wyłapie rabaty 6+6 i pokaże Twoje realne oszczędności.
        </p>

        <div className="mt-8 grid gap-3">
          <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <Camera className="w-5 h-5 text-emerald-200 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Błyskawiczny skan telefonem</p>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Kompresja w przeglądarce i analiza polskich paragonów w kilka sekund.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
            <PiggyBank className="w-5 h-5 text-emerald-200 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Oszczędności wg kategorii</p>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Sprawdzaj, na czym zyskujesz najwięcej: napoje, nabiał, chemia i więcej.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto mt-10 safe-bottom">
        {authError && (
          <div className="mb-4 rounded-xl bg-rose-500/20 border border-rose-300/40 px-4 py-3 text-sm text-rose-100">
            Nie udało się zalogować przez Google. Spróbuj ponownie.
          </div>
        )}

        <a
          href={GOOGLE_AUTH_URL}
          className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white text-slate-900 font-semibold py-4 px-5 shadow-lg shadow-slate-950/30 active:scale-[0.99] transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.29v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4-3.1Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76Z"
            />
          </svg>
          Kontynuuj z Google
        </a>

        <p className="mt-3 text-center text-xs text-emerald-100/70">
          Sesja pozostaje aktywna przez 30 dni — bez ciągłego logowania w PWA.
        </p>
      </div>
    </div>
  );
}
