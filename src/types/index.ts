export type SessionStatus = 'pending' | 'printing' | 'completed' | 'cancelled';

export interface FileItem {
  id: string;
  sessionId: string;
  originalName: string;
  sanitizedName?: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  downloadUrl?: string;
  uploadedAt: string;
}

export interface PrintSpecs {
  printType: 'bw' | 'color' | 'photo';
  sides: 'single' | 'double';
  copies: number;
  notes?: string;
}

export interface UploadSession {
  id: string;
  tokenNumber: string;
  customerName: string;
  orderNumber?: string;
  phoneNumber?: string;
  printNotes?: string;
  printType?: 'bw' | 'color' | 'photo';
  sides?: 'single' | 'double';
  copies?: number;
  status: SessionStatus;
  fileCount: number;
  totalSizeBytes: number;
  createdAt: string;
  updatedAt?: string;
  files?: FileItem[];
}
