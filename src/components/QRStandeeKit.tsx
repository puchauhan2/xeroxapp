import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Printer, Copy, Check, Sparkles, Store, ShieldCheck, Smartphone } from 'lucide-react';

interface QRStandeeKitProps {
  uploadUrl: string;
}

export const QRStandeeKit: React.FC<QRStandeeKitProps> = ({ uploadUrl }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shopName, setShopName] = useState<string>('Shree Sai Xerox & Cyber Point');
  const [shopPhone, setShopPhone] = useState<string>('+91 98765 43210');
  const [copied, setCopied] = useState<boolean>(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    QRCode.toDataURL(uploadUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [uploadUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(uploadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQrOnly = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${shopName.replace(/\s+/g, '_')}_Upload_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintStandee = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Configuration bar */}
      <div className="print:hidden rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Store className="h-6 w-6 text-blue-600" />
              Shop Counter QR Code & Printable Standee
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Place this at your xerox desk, counter glass, or billing station so customers can upload documents instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
              {copied ? 'Link Copied!' : 'Copy Upload Link'}
            </button>

            <button
              onClick={handleDownloadQrOnly}
              className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition shadow-xs"
            >
              <Download className="h-4 w-4" />
              Download QR (PNG)
            </button>

            <button
              onClick={handlePrintStandee}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 shadow-md transition active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Print Shop Standee / Flyer
            </button>
          </div>
        </div>

        {/* Customizer settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Shop Name (appears on standee)
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="e.g. Om Digital Xerox & Print Center"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Shop Contact / Help Number
            </label>
            <input
              type="text"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Destination link display */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Customer Upload URL for QR Code:
            </label>
            {uploadUrl.includes('ais-dev-') && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold">
                ⚠️ Development Sandbox URL (Deploy in AI Studio for public shared access)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={uploadUrl}
              readOnly
              className="w-full font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Note: The private <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">ais-dev-...</code> URL is protected by Google Cloud infrastructure for the project owner. Once you click <strong>Deploy / Share</strong> in the top-right AI Studio header, Google activates the public <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">ais-pre-...</code> link which opens on any customer&apos;s phone with zero Google account login required.
          </p>
        </div>
      </div>

      {/* Standee Preview Card (Optimized for both Screen and Physical Paper Print) */}
      <div className="flex justify-center">
        <div
          ref={printRef}
          className="standee-print-card w-full max-w-lg rounded-3xl bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-900 p-8 text-white shadow-2xl border-4 border-orange-500/40 relative overflow-hidden"
        >
          {/* Subtle decorative circles */}
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />

          {/* Top Header */}
          <div className="text-center relative z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 border border-orange-400/40 px-3 py-1 text-xs font-bold tracking-wider uppercase text-orange-300 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-orange-400" />
              Direct Counter Upload • No Login or App Required
            </span>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
              {shopName || 'Shop Document Desk'}
            </h1>
            <p className="text-xs sm:text-sm text-blue-200 font-medium mt-1">
              Photocopy • Printout • Color Xerox • Lamination • Scanning
            </p>
          </div>

          {/* Hindi & English Attention Box */}
          <div className="mt-5 rounded-2xl bg-white/10 backdrop-blur-md p-3.5 text-center border border-white/15">
            <p className="text-base sm:text-lg font-bold text-amber-300">
              यहाँ QR कोड स्कैन करें और अपने डॉक्युमेंट्स सीधे भेजें
            </p>
            <p className="text-xs text-blue-100 mt-0.5">
              Scan with any phone camera or Google Lens to upload your files instantly
            </p>
          </div>

          {/* High-Resolution QR Box */}
          <div className="mt-6 flex flex-col items-center justify-center">
            <div className="relative rounded-3xl bg-white p-5 shadow-2xl ring-8 ring-white/20">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Customer Upload QR Code"
                  className="h-56 w-56 sm:h-64 sm:w-64 object-contain"
                />
              ) : (
                <div className="h-56 w-56 flex items-center justify-center bg-slate-100 text-slate-400">
                  Loading QR...
                </div>
              )}
              {/* Center Shop Mini Badge */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-12 w-12 rounded-xl bg-orange-600 shadow-lg border-2 border-white flex items-center justify-center text-white font-black text-xs">
                  PRINT
                </div>
              </div>
            </div>

            <div className="mt-3 text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200">
                <Smartphone className="h-4 w-4 text-orange-400" />
                Works on all Android & iPhone cameras
              </span>
            </div>
          </div>

          {/* 3 Step Instructions */}
          <div className="mt-6 grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-xl bg-white/10 p-2.5 border border-white/10">
              <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-black">
                1
              </div>
              <div className="text-[11px] font-bold text-white mt-1">Scan QR</div>
              <div className="text-[9px] text-blue-200">No app needed</div>
            </div>

            <div className="rounded-xl bg-white/10 p-2.5 border border-white/10">
              <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-black">
                2
              </div>
              <div className="text-[11px] font-bold text-white mt-1">Pick Files</div>
              <div className="text-[9px] text-blue-200">PDF, JPG, Docs</div>
            </div>

            <div className="rounded-xl bg-white/10 p-2.5 border border-white/10">
              <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-black">
                3
              </div>
              <div className="text-[11px] font-bold text-white mt-1">Get Token</div>
              <div className="text-[9px] text-blue-200">Collect printout</div>
            </div>
          </div>

          {/* Footer with Privacy Reassurance */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-300">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              100% Private • Auto-purged
            </span>
            <span>Helpline: {shopPhone}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
