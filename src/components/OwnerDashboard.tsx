import React, { useEffect, useState, useMemo } from 'react';
import {
  UploadSession,
  FileItem,
  SessionStatus,
} from '../types';
import {
  db,
  auth,
  loginWithGoogle,
  logoutUser,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { playCounterChime } from '../utils/audio';
import { FilePreviewModal } from './FilePreviewModal';
import {
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  Clock,
  User as UserIcon,
  Phone,
  FileText,
  Archive,
  RefreshCw,
  Bell,
  BellOff,
  CheckCircle,
  AlertCircle,
  FileArchive,
  Printer,
  ChevronDown,
  Layers,
  Sparkles,
  ShieldCheck,
  LogIn,
  LogOut,
  SlidersHorizontal,
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Preview Modal
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // Action status indicators
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Track initial load to prevent chime on first load
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listen to Firestore Upload Sessions in Real-Time
  useEffect(() => {
    const q = query(collection(db, 'sessions'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const list: UploadSession[] = [];
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as UploadSession;
            // Fetch subcollection files for each session
            try {
              const filesSnap = await getDocs(collection(db, 'sessions', docSnap.id, 'files'));
              const fileList: FileItem[] = [];
              filesSnap.forEach((fDoc) => {
                fileList.push(fDoc.data() as FileItem);
              });
              data.files = fileList;
            } catch (err) {
              // Non-fatal if subcollection reading restricted
            }
            list.push({ ...data, id: docSnap.id });
          }

          // Sort descending by creation date
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          // Trigger chime if a new session arrived after initial load
          if (initialLoaded && list.length > sessions.length && soundEnabled) {
            playCounterChime();
          }

          setSessions(list);
          setLoadingSessions(false);
          setInitialLoaded(true);
        } catch (err) {
          console.error('Error in onSnapshot listener:', err);
        }
      },
      (error) => {
        console.warn('Firestore onSnapshot listener notice:', error);
        // Fallback: poll server /api/health or sessions
        fetchServerSessions();
      }
    );

    return () => unsubscribe();
  }, [initialLoaded, soundEnabled, sessions.length]);

  // Fallback to fetch from server
  const fetchServerSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          setSessions((prev) => {
            const map = new Map<string, UploadSession>();
            data.sessions.forEach((s: UploadSession) => map.set(s.id, s));
            prev.forEach((s) => map.set(s.id, s));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
      }
    } catch (e) {
      console.debug('Server sessions fetch notice:', e);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchServerSessions();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setErrorMsg(null);
      await loginWithGoogle();
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Update session status (e.g. pending -> printing -> completed)
  const handleUpdateStatus = async (sessionId: string, newStatus: SessionStatus) => {
    setActionLoadingId(sessionId);
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, { status: newStatus, updatedAt: new Date().toISOString() });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: newStatus } : s))
      );
    } catch (err) {
      console.error('Status update notice:', err);
      // Update local state even if offline
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: newStatus } : s))
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete customer upload session & wipe storage files
  const handleDeleteSession = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    setErrorMsg(null);
    try {
      // 1. Call server to wipe storage and local files
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to delete files from storage.');
      }

      // 2. Delete from Firestore if permitted
      try {
        await deleteDoc(doc(db, 'sessions', sessionId));
      } catch (e) {
        console.warn('Firestore session doc deletion handled:', e);
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Error deleting session:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Deletion failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Download single file
  const handleDownloadFile = (file: FileItem) => {
    const downloadUrl = `/api/files/${file.sessionId}/${file.id}/download`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', file.originalName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download all session files as a ZIP archive
  const handleDownloadZip = (session: UploadSession) => {
    const zipUrl = `/api/sessions/${session.id}/zip`;
    const link = document.createElement('a');
    link.href = zipUrl;
    link.setAttribute('download', `${session.tokenNumber}_${session.customerName}_documents.zip`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        s.customerName.toLowerCase().includes(term) ||
        s.tokenNumber.toLowerCase().includes(term) ||
        (s.phoneNumber && s.phoneNumber.includes(term)) ||
        (s.orderNumber && s.orderNumber.toLowerCase().includes(term)) ||
        (s.files && s.files.some((f) => f.originalName.toLowerCase().includes(term)));
      return matchesStatus && matchesSearch;
    });
  }, [sessions, statusFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = sessions.length;
    const pending = sessions.filter((s) => s.status === 'pending').length;
    const printing = sessions.filter((s) => s.status === 'printing').length;
    const completed = sessions.filter((s) => s.status === 'completed').length;
    return { total, pending, printing, completed };
  }, [sessions]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Shop Owner Print Counter
            </h1>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time live queue of customer documents arriving at your shop desk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              soundEnabled
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
            }`}
            title="Toggle audio notification chime on new customer upload"
          >
            {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span>{soundEnabled ? 'Bell ON' : 'Bell Muted'}</span>
          </button>

          {/* User Auth Info */}
          {currentUser ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 px-3 py-1.5">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="User" className="h-5 w-5 rounded-full" />
              ) : (
                <UserIcon className="h-4 w-4 text-slate-500" />
              )}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                {currentUser.displayName || currentUser.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-slate-400 hover:text-red-600 transition p-0.5 ml-1"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition"
              title="Optional: Link Google account for remote backup"
            >
              <LogIn className="h-3.5 w-3.5 text-slate-300" />
              <span>Owner Sync (Optional)</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">Total Jobs Today</span>
          <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white font-mono">
            {stats.total}
          </div>
        </div>

        <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 p-4 border border-amber-200 dark:border-amber-900/40 shadow-xs">
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">Needs Printing</span>
          <div className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">
            {stats.pending}
          </div>
        </div>

        <div className="rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-900/40 shadow-xs">
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-400">In Progress</span>
          <div className="mt-1 text-2xl font-black text-blue-700 dark:text-blue-300 font-mono">
            {stats.printing}
          </div>
        </div>

        <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 p-4 border border-emerald-200 dark:border-emerald-900/40 shadow-xs">
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">Completed</span>
          <div className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
            {stats.completed}
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by token, customer, phone..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['all', 'pending', 'printing', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize transition shrink-0 ${
                statusFilter === status
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {status === 'all' ? 'All Jobs' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 border border-red-200 dark:border-red-900 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Sessions Cards List */}
      {loadingSessions ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-12 text-center border border-slate-200 dark:border-slate-800">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Connecting to customer queue...
          </p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-12 text-center border border-slate-200 dark:border-slate-800">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {searchTerm || statusFilter !== 'all' ? 'No matching print jobs' : 'Counter Queue Empty'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search query or status filter.'
              : 'When customers scan your counter QR code and upload documents, they will pop up here in real time with an audio alert.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className={`rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xs border transition-all ${
                session.status === 'pending'
                  ? 'border-amber-400/80 dark:border-amber-500/50 ring-2 ring-amber-400/10'
                  : session.status === 'printing'
                  ? 'border-blue-400/80 dark:border-blue-500/50 ring-2 ring-blue-400/10'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Card Top: Token, Customer & Status */}
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-3 text-white shadow-md text-center min-w-[90px]">
                    <span className="block text-[9px] uppercase tracking-wider text-orange-400 font-bold">
                      Token
                    </span>
                    <span className="text-lg font-black font-mono tracking-tight">
                      {session.tokenNumber}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {session.customerName}
                      </h3>
                      {session.orderNumber && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-400">
                          #{session.orderNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                      {session.phoneNumber && (
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                          <Phone className="h-3 w-3" />
                          {session.phoneNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Switcher & Batch Action */}
                <div className="flex items-center gap-2">
                  <select
                    value={session.status}
                    onChange={(e) => handleUpdateStatus(session.id, e.target.value as SessionStatus)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition focus:outline-hidden ${
                      session.status === 'pending'
                        ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        : session.status === 'printing'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                        : session.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="printing">🖨️ Printing Now</option>
                    <option value="completed">✅ Completed</option>
                    <option value="cancelled">❌ Cancelled</option>
                  </select>

                  <button
                    onClick={() => handleDownloadZip(session)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition"
                    title="Download all files in this session as a single ZIP"
                  >
                    <FileArchive className="h-3.5 w-3.5" />
                    <span>Download All (ZIP)</span>
                  </button>

                  {/* Delete button with confirmation */}
                  {confirmDeleteId === session.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Confirm Wipe
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg bg-slate-200 dark:bg-slate-700 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(session.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      title="Delete customer files from storage"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Print requirements summary bar */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-500">Order Specs:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  {session.printType === 'bw' ? 'B & W' : session.printType === 'color' ? 'Full Color' : 'Photo Print'}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  {session.sides === 'single' ? 'Single Sided' : 'Both Sides (Duplex)'}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  {session.copies || 1} Cop{(session.copies || 1) > 1 ? 'ies' : 'y'}
                </span>
                {session.printNotes && (
                  <span className="rounded-md bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-amber-800 dark:text-amber-300 font-medium border border-amber-200/60 dark:border-amber-800/40">
                    Note: &quot;{session.printNotes}&quot;
                  </span>
                )}
              </div>

              {/* Files Table / List */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Attached Documents ({session.fileCount || (session.files?.length || 0)})</span>
                  <span>{(session.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB Total</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(session.files || []).map((file) => {
                    const isImg = file.mimeType.startsWith('image/');
                    const isPdf = file.mimeType.includes('pdf');
                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden mr-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-700 shadow-xs text-slate-700 dark:text-slate-200 font-bold text-[10px]">
                            {isPdf ? 'PDF' : isImg ? 'IMG' : 'DOC'}
                          </div>
                          <div className="truncate">
                            <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200" title={file.originalName}>
                              {file.originalName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {(isImg || isPdf) && (
                            <button
                              onClick={() => setPreviewFile(file)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                              title="Preview Document"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDownloadFile(file)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                            title="Download File to Phone / PC"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownloadFile}
        />
      )}
    </div>
  );
};
