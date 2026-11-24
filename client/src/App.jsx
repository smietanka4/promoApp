import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getMe, logout } from './api/client.js';
import LoginScreen from './components/LoginScreen.jsx';
import Dashboard from './components/Dashboard.jsx';
import ReceiptReview from './components/ReceiptReview.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [pendingScan, setPendingScan] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_error')) {
      setAuthError(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    getMe()
      .then((data) => {
        if (data?.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      setPendingScan(null);
    }
  }

  function handleSavedReceipt(savedReceipt) {
    setPendingScan(null);
    setRefreshToken((n) => n + 1);
    const saved = Number(savedReceipt?.total_saved || 0).toFixed(2).replace('.', ',');
    showToast(`Paragon zapisany! Zaoszczędzono ${saved} zł.`);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-50 text-emerald-700 gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Ładowanie PromoApp...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen authError={authError} />;
  }

  if (pendingScan) {
    return (
      <ReceiptReview
        scanResult={pendingScan}
        onCancel={() => setPendingScan(null)}
        onSaved={handleSavedReceipt}
      />
    );
  }

  return (
    <>
      {toast && (
        <div className="fixed top-4 inset-x-4 z-50 max-w-md mx-auto rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm font-medium shadow-xl text-center">
          {toast}
        </div>
      )}
      <Dashboard
        user={user}
        onLogout={handleLogout}
        onReceiptScanned={(result) => setPendingScan(result)}
        refreshToken={refreshToken}
      />
    </>
  );
}
