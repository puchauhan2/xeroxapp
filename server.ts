import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable JSON and URL-encoded parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Local persistent storage directory for fallback & rapid streaming
const UPLOADS_DIR = path.resolve(__dirname, 'uploads_storage');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory session and file registry for quick server-side lookup
interface StoredFile {
  id: string;
  sessionId: string;
  originalName: string;
  sanitizedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  localPath: string;
  uploadedAt: string;
}

interface StoredSession {
  id: string;
  tokenNumber: string;
  customerName: string;
  orderNumber?: string;
  phoneNumber?: string;
  printNotes?: string;
  printType?: string; // 'bw' | 'color' | 'photo'
  sides?: string; // 'single' | 'double'
  copies?: number;
  status: 'pending' | 'printing' | 'completed' | 'cancelled';
  fileCount: number;
  totalSizeBytes: number;
  createdAt: string;
  files: StoredFile[];
}

const memorySessions = new Map<string, StoredSession>();

// Cloud Storage setup (Firebase Cloud Storage bucket)
const BUCKET_NAME = 'gen-lang-client-0758227172.firebasestorage.app';
let gcsStorage: Storage | null = null;
try {
  gcsStorage = new Storage({
    projectId: 'gen-lang-client-0758227172',
  });
} catch (e) {
  console.warn('Google Cloud Storage SDK initialization warning:', e);
}

// Multer memory storage so we can stream to both Cloud Storage & disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max per file
    files: 10, // Max 10 files per submission
  },
  fileFilter: (_req, file, cb) => {
    // Validate MIME types and file extensions
    const allowedMimePrefixes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.doc', '.docx', '.txt'];

    if (allowedMimePrefixes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file format (${ext || file.mimetype}). Please upload PDF, JPG, PNG, WEBP, or DOC/DOCX.`
        )
      );
    }
  },
});

function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename).slice(0, 10);
  const name = path.basename(filename, ext);
  // Remove non-alphanumeric chars except dash and underscore
  const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${cleanName || 'document'}${ext}`;
}

// API: Customer Document Upload
app.post('/api/upload', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No documents provided for upload.' });
    }

    const customerName = (req.body.customerName || '').trim();
    if (!customerName) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }

    const orderNumber = (req.body.orderNumber || '').trim();
    const phoneNumber = (req.body.phoneNumber || '').trim();
    const printNotes = (req.body.printNotes || '').trim();
    const printType = req.body.printType || 'bw';
    const sides = req.body.sides || 'single';
    const copies = parseInt(req.body.copies || '1', 10) || 1;

    // Generate unique session and token number
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sessionId = `sess_${timestamp}_${randomSuffix}`;

    // Token format like DOC-4821 or custom token
    const tokenNumber = orderNumber
      ? `ORD-${orderNumber.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`
      : `DOC-${Math.floor(1000 + Math.random() * 9000)}`;

    const sessionDir = path.join(UPLOADS_DIR, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    let totalSizeBytes = 0;
    const storedFiles: StoredFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `f_${i + 1}_${Math.random().toString(36).substring(2, 7)}`;
      const sanitized = sanitizeFilename(file.originalname);
      const storageKey = `customer_uploads/${sessionId}/${fileId}_${sanitized}`;
      const localFilePath = path.join(sessionDir, `${fileId}_${sanitized}`);

      // 1. Write to local storage for fast streaming and ZIP operations
      fs.writeFileSync(localFilePath, file.buffer);
      totalSizeBytes += file.size;

      // 2. Upload to Firebase Cloud Storage bucket
      if (gcsStorage) {
        try {
          const bucket = gcsStorage.bucket(BUCKET_NAME);
          const gcsFile = bucket.file(storageKey);
          await gcsFile.save(file.buffer, {
            metadata: {
              contentType: file.mimetype,
              metadata: {
                sessionId,
                tokenNumber,
                originalName: file.originalname,
                customerName,
              },
            },
          });
        } catch (cloudErr) {
          console.warn(`Cloud Storage write warning for ${storageKey}:`, cloudErr);
        }
      }

      storedFiles.push({
        id: fileId,
        sessionId,
        originalName: file.originalname,
        sanitizedName: sanitized,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        storagePath: storageKey,
        localPath: localFilePath,
        uploadedAt: new Date().toISOString(),
      });
    }

    const newSession: StoredSession = {
      id: sessionId,
      tokenNumber,
      customerName,
      orderNumber,
      phoneNumber,
      printNotes,
      printType,
      sides,
      copies,
      status: 'pending',
      fileCount: storedFiles.length,
      totalSizeBytes,
      createdAt: new Date().toISOString(),
      files: storedFiles,
    };

    memorySessions.set(sessionId, newSession);

    return res.status(201).json({
      success: true,
      sessionId,
      tokenNumber,
      customerName,
      fileCount: storedFiles.length,
      totalSizeBytes,
      createdAt: newSession.createdAt,
      printNotes,
      printType,
      sides,
      copies,
      files: storedFiles.map((f) => ({
        id: f.id,
        sessionId: f.sessionId,
        originalName: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        storagePath: f.storagePath,
        uploadedAt: f.uploadedAt,
      })),
    });
  } catch (error) {
    console.error('Error during document upload:', error);
    const message = error instanceof Error ? error.message : 'Upload failed due to internal server error.';
    return res.status(500).json({ error: message });
  }
});

// API: List active sessions (Owner endpoint)
app.get('/api/sessions', (_req: Request, res: Response) => {
  const sessionsList = Array.from(memorySessions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return res.json({ sessions: sessionsList });
});

// API: File preview endpoint
app.get('/api/files/:sessionId/:fileId/preview', async (req: Request, res: Response) => {
  const { sessionId, fileId } = req.params;
  const session = memorySessions.get(sessionId);
  let fileInfo = session?.files.find((f) => f.id === fileId);

  // If not in memory, scan session directory
  const sessionDir = path.join(UPLOADS_DIR, sessionId);
  if (!fileInfo && fs.existsSync(sessionDir)) {
    const diskFiles = fs.readdirSync(sessionDir);
    const matched = diskFiles.find((name) => name.startsWith(`${fileId}_`));
    if (matched) {
      const ext = path.extname(matched).toLowerCase();
      let mime = 'application/octet-stream';
      if (['.jpg', '.jpeg'].includes(ext)) mime = 'image/jpeg';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.pdf') mime = 'application/pdf';

      fileInfo = {
        id: fileId,
        sessionId,
        originalName: matched.replace(`${fileId}_`, ''),
        sanitizedName: matched,
        mimeType: mime,
        sizeBytes: fs.statSync(path.join(sessionDir, matched)).size,
        storagePath: `customer_uploads/${sessionId}/${matched}`,
        localPath: path.join(sessionDir, matched),
        uploadedAt: new Date().toISOString(),
      };
    }
  }

  if (!fileInfo || !fs.existsSync(fileInfo.localPath)) {
    return res.status(404).send('File not found or has been purged.');
  }

  res.setHeader('Content-Type', fileInfo.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${fileInfo.sanitizedName}"`);
  fs.createReadStream(fileInfo.localPath).pipe(res);
});

// API: File download endpoint
app.get('/api/files/:sessionId/:fileId/download', async (req: Request, res: Response) => {
  const { sessionId, fileId } = req.params;
  const session = memorySessions.get(sessionId);
  let fileInfo = session?.files.find((f) => f.id === fileId);

  const sessionDir = path.join(UPLOADS_DIR, sessionId);
  if (!fileInfo && fs.existsSync(sessionDir)) {
    const diskFiles = fs.readdirSync(sessionDir);
    const matched = diskFiles.find((name) => name.startsWith(`${fileId}_`));
    if (matched) {
      const ext = path.extname(matched).toLowerCase();
      let mime = 'application/octet-stream';
      if (['.jpg', '.jpeg'].includes(ext)) mime = 'image/jpeg';
      else if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.pdf') mime = 'application/pdf';

      fileInfo = {
        id: fileId,
        sessionId,
        originalName: matched.replace(`${fileId}_`, ''),
        sanitizedName: matched,
        mimeType: mime,
        sizeBytes: fs.statSync(path.join(sessionDir, matched)).size,
        storagePath: `customer_uploads/${sessionId}/${matched}`,
        localPath: path.join(sessionDir, matched),
        uploadedAt: new Date().toISOString(),
      };
    }
  }

  if (!fileInfo || !fs.existsSync(fileInfo.localPath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  res.setHeader('Content-Type', fileInfo.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`
  );
  fs.createReadStream(fileInfo.localPath).pipe(res);
});

// API: Download all files in a session as ZIP
app.post('/api/sessions/:sessionId/zip', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = memorySessions.get(sessionId);
  const sessionDir = path.join(UPLOADS_DIR, sessionId);

  if (!fs.existsSync(sessionDir)) {
    return res.status(404).json({ error: 'Session files not found or already deleted.' });
  }

  try {
    const zip = new JSZip();
    const diskFiles = fs.readdirSync(sessionDir);

    if (diskFiles.length === 0) {
      return res.status(400).json({ error: 'No files in this session.' });
    }

    for (const fileName of diskFiles) {
      const filePath = path.join(sessionDir, fileName);
      if (fs.statSync(filePath).isFile()) {
        const fileContent = fs.readFileSync(filePath);
        // Find clean original name if available
        const matched = session?.files.find((f) => f.sanitizedName === fileName);
        const displayName = matched ? matched.originalName : fileName;
        zip.file(displayName, fileContent);
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const tokenLabel = session?.tokenNumber || sessionId.slice(-6);
    const cleanCustomer = (session?.customerName || 'customer').replace(/[^a-zA-Z0-9]/g, '_');
    const zipName = `${tokenLabel}_${cleanCustomer}_documents.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);
    res.send(zipBuffer);
  } catch (error) {
    console.error('Error generating zip archive:', error);
    res.status(500).json({ error: 'Failed to generate ZIP archive.' });
  }
});

// API: Delete session and its files (Shop owner action)
app.delete('/api/sessions/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const sessionDir = path.join(UPLOADS_DIR, sessionId);

  try {
    // 1. Delete local disk directory
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    // 2. Delete from Firebase Cloud Storage bucket if initialized
    if (gcsStorage) {
      try {
        const bucket = gcsStorage.bucket(BUCKET_NAME);
        await bucket.deleteFiles({ prefix: `customer_uploads/${sessionId}/` });
      } catch (cloudErr) {
        console.warn(`Cloud storage purge warning for session ${sessionId}:`, cloudErr);
      }
    }

    // 3. Remove from memory
    memorySessions.delete(sessionId);

    return res.json({ success: true, message: 'Customer files purged securely.' });
  } catch (err) {
    console.error('Error deleting session files:', err);
    return res.status(500).json({ error: 'Failed to delete files.' });
  }
});

// API: Health & Diagnostic Info
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    storageBucket: BUCKET_NAME,
    uploadsDirAvailable: fs.existsSync(UPLOADS_DIR),
    activeSessionsCount: memorySessions.size,
    cloudStorageEnabled: !!gcsStorage,
  });
});

// Vite Development or Production Server
async function setupServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`DocuDrop India Server running on port ${PORT} (dev: ${isDev})`);
  });
}

setupServer();
