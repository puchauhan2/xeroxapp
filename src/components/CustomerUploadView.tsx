import React, { useState, useRef } from 'react';
import {
  Upload,
  Camera,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Check,
  Printer,
  FileCheck,
} from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface FileUploadState {
  file: File;
  id: string;
  progress: number;
  status: 'queued' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
  previewUrl?: string;
}

export const CustomerUploadView: React.FC = () => {
  const [customerName, setCustomerName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [printNotes, setPrintNotes] = useState('');
  const [printType, setPrintType] = useState<'bw' | 'color' | 'photo'>('bw');
  const [sides, setSides] = useState<'single' | 'double'>('single');
  const [copies, setCopies] = useState<number>(1);

  const [filesList, setFilesList] = useState<FileUploadState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Success Receipt State
  const [receiptToken, setReceiptToken] = useState<string | null>(null);
  const [uploadedSessionData, setUploadedSessionData] = useState<{
    tokenNumber: string;
    customerName: string;
    fileCount: number;
    totalSizeBytes: number;
    createdAt: string;
    printType: string;
    sides: string;
    copies: number;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
  const MAX_FILES = 10;

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setGeneralError(null);

    const newFiles: File[] = Array.from(e.target.files);
    if (filesList.length + newFiles.length > MAX_FILES) {
      setGeneralError(`Maximum limit is ${MAX_FILES} documents per upload session.`);
      return;
    }

    const prepared = newFiles.map((f) => {
      let previewUrl: string | undefined = undefined;
      if (f.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(f);
      }
      return {
        file: f,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        progress: 0,
        status: (f.size > MAX_FILE_SIZE ? 'error' : 'queued') as 'queued' | 'error',
        errorMessage: f.size > MAX_FILE_SIZE ? `Exceeds 25 MB limit (${(f.size / (1024 * 1024)).toFixed(1)} MB)` : undefined,
        previewUrl,
      };
    });

    setFilesList((prev) => [...prev, ...prepared]);
    // Reset file input value so same files can be re-selected if removed
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFilesList((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUploadSubmit = async () => {
    if (!customerName.trim()) {
      setGeneralError('Please enter your name so the shopkeeper can identify your printout.');
      return;
    }

    const validFiles = filesList.filter((f) => f.status !== 'error');
    if (validFiles.length === 0) {
      setGeneralError('Please select at least one document or image to upload.');
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);
    setOverallProgress(10);

    const formData = new FormData();
    formData.append('customerName', customerName.trim());
    formData.append('orderNumber', orderNumber.trim());
    formData.append('phoneNumber', phoneNumber.trim());
    formData.append('printNotes', printNotes.trim());
    formData.append('printType', printType);
    formData.append('sides', sides);
    formData.append('copies', String(copies));

    validFiles.forEach((item) => {
      formData.append('files', item.file);
    });

    try {
      // Use XMLHttpRequest to track live upload progress percentage
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 90);
          setOverallProgress(Math.max(15, percent));
          setFilesList((prev) =>
            prev.map((f) => (f.status !== 'error' ? { ...f, progress: percent, status: 'uploading' } : f))
          );
        }
      };

      const responsePromise = new Promise<{
        success: boolean;
        sessionId: string;
        tokenNumber: string;
        customerName: string;
        fileCount: number;
        totalSizeBytes: number;
        createdAt: string;
        printType: string;
        sides: string;
        copies: number;
        files?: { id: string; sessionId: string; originalName: string; mimeType: string; sizeBytes: number; storagePath: string; uploadedAt: string }[];
      }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resJson = JSON.parse(xhr.responseText);
              resolve(resJson);
            } catch (e) {
              reject(new Error('Invalid server response format.'));
            }
          } else {
            try {
              const resJson = JSON.parse(xhr.responseText);
              reject(new Error(resJson.error || `Server returned error (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed with status code ${xhr.status}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network connection error while uploading files.'));
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);

      const result = await responsePromise;

      // Sync to Firestore for real-time live shop queue
      try {
        await setDoc(doc(db, 'sessions', result.sessionId), {
          id: result.sessionId,
          tokenNumber: result.tokenNumber,
          customerName: result.customerName,
          orderNumber: orderNumber.trim() || '',
          phoneNumber: phoneNumber.trim() || '',
          printNotes: printNotes.trim() || '',
          status: 'pending',
          fileCount: result.fileCount,
          totalSizeBytes: result.totalSizeBytes,
          createdAt: result.createdAt,
          updatedAt: result.createdAt,
          printType,
          sides,
          copies,
        });

        // Also add files to subcollection
        const resFiles = (result as unknown as { files?: { id: string; sessionId: string; originalName: string; mimeType: string; sizeBytes: number; storagePath: string; uploadedAt: string }[] }).files || [];
        for (const f of resFiles) {
          await setDoc(doc(db, 'sessions', result.sessionId, 'files', f.id), {
            id: f.id,
            sessionId: f.sessionId,
            originalName: f.originalName,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            storagePath: f.storagePath,
            uploadedAt: f.uploadedAt,
          });
        }
      } catch (firestoreErr) {
        console.warn('Realtime Firestore sync notice:', firestoreErr);
      }

      setOverallProgress(100);
      setReceiptToken(result.tokenNumber);
      setUploadedSessionData(result);

      setFilesList((prev) =>
        prev.map((f) => (f.status !== 'error' ? { ...f, progress: 100, status: 'completed' } : f))
      );
    } catch (err) {
      console.error('Customer upload failure:', err);
      const msg = err instanceof Error ? err.message : 'Upload failed. Please check internet and try again.';
      setGeneralError(msg);
      setFilesList((prev) =>
        prev.map((f) => (f.status === 'uploading' ? { ...f, status: 'error', errorMessage: msg } : f))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyReceipt = () => {
    if (!receiptToken) return;
    navigator.clipboard.writeText(receiptToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const handleResetForNewUpload = () => {
    setReceiptToken(null);
    setUploadedSessionData(null);
    setFilesList([]);
    setPrintNotes('');
    setOverallProgress(0);
    setGeneralError(null);
  };

  // SUCCESS RECEIPT SCREEN
  if (receiptToken && uploadedSessionData) {
    return (
      <div className="max-w-xl mx-auto py-6 px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl border border-emerald-500/30 text-center relative overflow-hidden">
          {/* Top festive header */}
          <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 absolute top-0 left-0 right-0" />

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 mb-4 shadow-xs">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Documents Sent to Counter!
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            दस्तावेज़ सफलतापूर्वक भेजे गए हैं
          </p>

          {/* Token Card */}
          <div className="my-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800/80 p-6 border-2 border-dashed border-orange-300 dark:border-orange-500/40">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              Your Counter Token Number
            </span>
            <div className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
              {receiptToken}
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              Tell this token number or your name <strong className="text-slate-900 dark:text-white">({uploadedSessionData.customerName})</strong> at the shop counter
            </p>

            <button
              onClick={handleCopyReceipt}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition"
            >
              {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedToken ? 'Token Copied!' : 'Copy Token Number'}
            </button>
          </div>

          {/* Summary info */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-left text-xs space-y-2 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Customer Name:</span>
              <strong className="text-slate-900 dark:text-white">{uploadedSessionData.customerName}</strong>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total Documents:</span>
              <strong className="text-slate-900 dark:text-white">{uploadedSessionData.fileCount} File(s)</strong>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Print Selection:</span>
              <strong className="text-slate-900 dark:text-white">
                {uploadedSessionData.printType === 'bw' ? 'Black & White' : uploadedSessionData.printType === 'color' ? 'Color Print' : 'Photo Print'} • {uploadedSessionData.sides === 'single' ? 'Single Sided' : 'Back-to-Back'} • {uploadedSessionData.copies} Cop(ies)
              </strong>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Time:</span>
              <span className="font-mono text-slate-500">
                {new Date(uploadedSessionData.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Privacy Guarantee */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Files are encrypted & will be deleted after printing.</span>
          </div>

          {/* Action to upload more */}
          <button
            onClick={handleResetForNewUpload}
            className="mt-6 w-full rounded-2xl bg-slate-900 dark:bg-white py-3 text-sm font-bold text-white dark:text-slate-900 hover:opacity-95 shadow-lg transition active:scale-98"
          >
            Upload More Documents
          </button>
        </div>
      </div>
    );
  }

  // UPLOAD FORM SCREEN
  return (
    <div className="max-w-xl mx-auto py-4 px-4 sm:px-6">
      {/* Shop welcome header banner */}
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
          <Check className="h-3.5 w-3.5" />
          No Login or Account Required • 100% Free & Direct
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Upload Documents for Print
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          दस्तावेज़ सीधे काउंटर पर भेजें • No WhatsApp or Google Login Needed
        </p>
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-lg border border-slate-200/80 dark:border-slate-800 space-y-5">
        {/* Step 1: Customer Details */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
            1. Your Name / आपका नाम <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Rahul Sharma"
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Optional Phone / Order Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Mobile Number (Optional)
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Order / Token # (If given by shop)
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. 104"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Step 2: Print Requirements */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
            2. Print Specifications / प्रिंट की आवश्यकता
          </label>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPrintType('bw')}
              className={`rounded-xl p-2.5 font-bold border transition text-center ${
                printType === 'bw'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>B & W (₹2)</div>
              <div className="text-[10px] font-normal text-slate-500">Black & White</div>
            </button>

            <button
              type="button"
              onClick={() => setPrintType('color')}
              className={`rounded-xl p-2.5 font-bold border transition text-center ${
                printType === 'color'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>Color (₹10)</div>
              <div className="text-[10px] font-normal text-slate-500">Full Color</div>
            </button>

            <button
              type="button"
              onClick={() => setPrintType('photo')}
              className={`rounded-xl p-2.5 font-bold border transition text-center ${
                printType === 'photo'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>Photo Print</div>
              <div className="text-[10px] font-normal text-slate-500">Glossy / Card</div>
            </button>
          </div>

          {/* Sides & Copies selection */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Page Sides</span>
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSides('single')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    sides === 'single' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500'
                  }`}
                >
                  Single Side
                </button>
                <button
                  type="button"
                  onClick={() => setSides('double')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                    sides === 'double' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500'
                  }`}
                >
                  Both Sides
                </button>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Number of Sets</span>
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.max(1, c - 1))}
                  className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  -
                </button>
                <span className="flex-1 text-center text-xs font-bold font-mono text-slate-900 dark:text-white">
                  {copies} {copies === 1 ? 'Copy' : 'Copies'}
                </span>
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.min(50, c + 1))}
                  className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Print note */}
          <div className="mt-3">
            <input
              type="text"
              value={printNotes}
              onChange={(e) => setPrintNotes(e.target.value)}
              placeholder="Notes for shopkeeper: e.g. Page 1 to 4 only, A4 size, spiral binding"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Step 3: Document Upload Area */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              3. Select Documents / फाइल्स चुनें
            </label>
            <span className="text-[11px] text-slate-400">PDF, JPG, PNG, DOCX (Max 25MB)</span>
          </div>

          {/* Dual Action Buttons: Camera Snap + File Picker */}
          <div className="grid grid-cols-2 gap-3">
            {/* Hidden inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelection}
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileSelection}
              capture="environment"
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-300 dark:border-orange-500/40 bg-orange-50/50 dark:bg-orange-950/20 py-3.5 px-4 text-xs font-bold text-orange-700 dark:text-orange-400 hover:bg-orange-100/60 transition active:scale-98"
            >
              <Camera className="h-5 w-5 text-orange-600" />
              <span>Take Photo</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20 py-3.5 px-4 text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 transition active:scale-98"
            >
              <Upload className="h-5 w-5 text-blue-600" />
              <span>Browse Files</span>
            </button>
          </div>

          {/* Files List Preview */}
          {filesList.length > 0 && (
            <div className="mt-4 space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Selected Files ({filesList.length} of {MAX_FILES})
              </span>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {filesList.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                      item.status === 'error'
                        ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden mr-2">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt="preview"
                          className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}

                      <div className="truncate">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-white" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                          {item.errorMessage && (
                            <span className="text-red-500 ml-1.5">• {item.errorMessage}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'uploading' && (
                        <div className="text-[10px] font-bold text-blue-600 font-mono animate-pulse">
                          {item.progress}%
                        </div>
                      )}
                      {item.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                      {!isSubmitting && (
                        <button
                          type="button"
                          onClick={() => removeFile(item.id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition"
                          title="Remove file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* General Error Banner */}
        {generalError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">
              <span>{generalError}</span>
              {generalError.includes('upload') && (
                <button
                  onClick={handleUploadSubmit}
                  className="mt-1 block font-bold underline hover:opacity-80"
                >
                  Retry Upload
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Progress Bar during upload */}
        {isSubmitting && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-orange-600" />
                Sending documents to shop counter...
              </span>
              <span className="font-mono text-orange-600">{overallProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          disabled={isSubmitting || filesList.length === 0}
          onClick={handleUploadSubmit}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 px-6 font-bold text-white shadow-lg transition active:scale-98 ${
            isSubmitting || filesList.length === 0
              ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 shadow-orange-500/25'
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Uploading to Counter ({overallProgress}%)...</span>
            </>
          ) : (
            <>
              <FileCheck className="h-5 w-5" />
              <span>
                Send {filesList.length > 0 ? `${filesList.length} Document(s)` : 'Documents'} to Counter
              </span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </button>

        {/* Customer Privacy Notice */}
        <p className="text-[11px] text-center text-slate-400">
          🔒 Secure upload: Your documents are transferred directly to the shop counter and are not publicly searchable or visible to other customers.
        </p>
      </div>
    </div>
  );
};
