import React from 'react';
import { PWAInstallButton } from './PWAInstallButton';
import {
  Printer,
  UploadCloud,
  QrCode,
  ShieldCheck,
  Smartphone,
  ExternalLink,
} from 'lucide-react';

interface NavbarProps {
  currentView: 'upload' | 'dashboard' | 'qr';
  onSelectView: (view: 'upload' | 'dashboard' | 'qr') => void;
  pendingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onSelectView, pendingCount }) => {
  // If in customer upload view, show customer-friendly header without owner dashboard/login controls
  if (currentView === 'upload') {
    return (
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  DocuDrop <span className="text-orange-600">India</span>
                </span>
                <span className="rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5">
                  Direct Upload Desk
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Scan QR • Pick Documents • Collect Print at Counter
              </p>
            </div>
          </div>

          {/* Right Action: Discreet Owner Switch */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectView('dashboard')}
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Shopkeeper / Owner login & management counter"
            >
              Shopkeeper Desk ➔
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Owner View Header
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectView('dashboard')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                DocuDrop <span className="text-orange-600">India</span>
              </span>
              <span className="rounded-md bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 text-[10px] font-bold px-1.5 py-0.5">
                OWNER DESK
              </span>
            </div>
            <p className="text-[10px] text-slate-500 hidden sm:block">
              Shop Management & Print Queue
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onSelectView('dashboard')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition relative ${
              currentView === 'dashboard'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Printer className="h-4 w-4" />
            <span>Counter Queue</span>
            {pendingCount > 0 && (
              <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectView('qr')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
              currentView === 'qr'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Shop QR Standee</span>
          </button>

          <button
            onClick={() => onSelectView('upload')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition"
            title="Open customer view"
          >
            <UploadCloud className="h-4 w-4 text-blue-600" />
            <span className="hidden sm:inline">View Customer Page</span>
          </button>
        </nav>

        {/* Right Actions: PWA Install */}
        <div className="flex items-center gap-2">
          <PWAInstallButton compact={true} />
        </div>
      </div>
    </header>
  );
};
