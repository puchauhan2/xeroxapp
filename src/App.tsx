import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CustomerUploadView } from './components/CustomerUploadView';
import { OwnerDashboard } from './components/OwnerDashboard';
import { QRStandeeKit } from './components/QRStandeeKit';
import { OfflineIndicator } from './components/OfflineIndicator';
import { db } from './firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export default function App() {
  const [currentView, setCurrentView] = useState<'upload' | 'dashboard' | 'qr'>('upload');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [uploadUrl, setUploadUrl] = useState<string>('');

  // Determine initial view from URL query params (default is customer upload)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'dashboard' || viewParam === 'owner' || window.location.pathname.includes('/owner')) {
      setCurrentView('dashboard');
    } else if (viewParam === 'qr') {
      setCurrentView('qr');
    } else {
      setCurrentView('upload');
    }

    // Set dynamic public HTTPS upload URL for customer QR scans
    const origin = window.location.origin;
    setUploadUrl(`${origin}/?view=upload`);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Offline Status Banner */}
      <OfflineIndicator />

      {/* Navigation */}
      <div className="print:hidden">
        <Navbar
          currentView={currentView}
          onSelectView={setCurrentView}
          pendingCount={pendingCount}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentView === 'upload' && <CustomerUploadView />}
        {currentView === 'dashboard' && <OwnerDashboard />}
        {currentView === 'qr' && <QRStandeeKit uploadUrl={uploadUrl} />}
      </main>

      {/* Print Friendly Standee Footnote or App Footer */}
      <footer className="print:hidden border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} DocuDrop India • Built for Photocopy Shops & Cyber Cafés</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Direct Counter Pipe Active
            </span>
            <span>Files Auto-Purged After Print</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
