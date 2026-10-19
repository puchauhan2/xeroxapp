import React, { useState } from 'react';
import { FileItem } from '../types';
import { X, Download, Printer, ZoomIn, ZoomOut, RotateCw, FileText, ExternalLink } from 'lucide-react';

interface FilePreviewModalProps {
  file: FileItem;
  onClose: () => void;
  onDownload: (file: FileItem) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose, onDownload }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const previewUrl = `/api/files/${file.sessionId}/${file.id}/preview`;
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf' || file.originalName.toLowerCase().endsWith('.pdf');

  const handlePrint = () => {
    const printWindow = window.open(previewUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative flex flex-col h-[92vh] w-full max-w-5xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 gap-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/50">
              <FileText className="h-5 w-5" />
            </div>
            <div className="truncate">
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={file.originalName}>
                {file.originalName}
              </h3>
              <p className="text-xs text-slate-500">
                {(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {file.mimeType}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {isImage && (
              <>
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-xs font-mono font-medium text-slate-500 min-w-[40px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  title="Rotate 90°"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
              title="Print directly"
            >
              <Printer className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={() => onDownload(file)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
              title="Download to device"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Preview Content Area */}
        <div className="relative flex-1 overflow-auto bg-slate-900/10 p-4 dark:bg-black/40 flex items-center justify-center">
          {isImage ? (
            <div className="flex items-center justify-center transition-all duration-200 ease-out">
              <img
                src={previewUrl}
                alt={file.originalName}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  maxWidth: '100%',
                  maxHeight: '80vh',
                }}
                className="rounded-lg shadow-lg object-contain transition-transform"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${previewUrl}#toolbar=1`}
              title={file.originalName}
              className="h-full w-full rounded-lg border-0 bg-white shadow-md"
            />
          ) : (
            <div className="text-center p-8 max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
              <FileText className="mx-auto h-16 w-16 text-slate-400 mb-4" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                Document Preview Not Available Inline
              </h4>
              <p className="text-xs text-slate-500 mb-6">
                This document format (.doc, .docx or binary) can be opened directly with Microsoft Word, LibreOffice, or Google Docs after download.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => onDownload(file)}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-md transition"
                >
                  <Download className="h-4 w-4" />
                  Download File
                </button>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
