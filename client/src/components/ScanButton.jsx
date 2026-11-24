import { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, Loader2 } from 'lucide-react';
import { scanReceipt } from '../api/client.js';

export default function ScanButton({ onScanned, onError }) {
  const inputRef = useRef(null);
  const [status, setStatus] = useState(null); // null | 'compressing' | 'analyzing'

  const isBusy = status !== null;

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    // Reset inputa, aby umożliwić ponowne wybranie tego samego zdjęcia
    event.target.value = '';
    if (!file) return;

    try {
      setStatus('compressing');
      const compressedFile = await imageCompression(file, {
        maxWidthOrHeight: 1600,
        maxSizeMB: 1.5,
        fileType: 'image/jpeg',
        initialQuality: 0.82,
        useWebWorker: true,
      });

      setStatus('analyzing');
      const result = await scanReceipt(compressedFile);
      onScanned(result);
    } catch (err) {
      onError(err.message || 'Nie udało się przeanalizować paragonu. Spróbuj ponownie.');
    } finally {
      setStatus(null);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={isBusy}
      />

      <button
        type="button"
        disabled={isBusy}
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-75 text-white font-semibold py-4 px-6 shadow-lg shadow-emerald-600/30 transition cursor-pointer"
      >
        {isBusy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>
              {status === 'compressing'
                ? 'Kompresuję zdjęcie...'
                : 'AI odczytuje paragon i rabaty...'}
            </span>
          </>
        ) : (
          <>
            <Camera className="w-5 h-5" />
            <span>Skanuj paragon</span>
          </>
        )}
      </button>
    </>
  );
}
