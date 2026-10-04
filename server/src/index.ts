/**
 * Express Backend Server for KinesioLive
 * Conforms to ORIGINAL_REQUEST.md § R2, PROJECT.md § Features 6-12, and docs/trd.md § Section 4
 */

import cors from 'cors';
import dotenv from 'dotenv';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserRole } from '@kinesio/shared';
import { createOrJoinSession, runBootDiagnostics } from './cometchatRest.js';

// Resolve directory and load monorepo root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // Fallback for process.cwd()

// Run diagnostic credential validation on boot
runBootDiagnostics();

export const app: Express = express();

// Middleware setup
app.use(cors());
app.use(express.json());

// Handle JSON parsing errors gracefully with HTTP 400
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

/**
 * GET /api/health
 * Returns HTTP 200 with strictly { status, uptime, timestamp }
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

/**
 * POST /api/session
 * Accepts SessionRequest ({ role: "clinician" | "patient", sessionId?: string })
 * Coordinates user upsert, group upsert, auth token minting, and returns sanitized SessionResponse.
 */
app.post('/api/session', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const { role, sessionId } = req.body;

  if (!role || typeof role !== 'string' || (role !== 'clinician' && role !== 'patient')) {
    return res.status(400).json({ error: 'Invalid or missing role: must be "clinician" or "patient"' });
  }

  try {
    const sessionResponse = await createOrJoinSession(role as UserRole, sessionId);
    return res.status(200).json(sessionResponse);
  } catch (error: any) {
    console.error('[ERROR] /api/session error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to initialize session' });
  }
});

// Serve compiled React SPA — must come AFTER all /api routes
const distPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(distPath));

// SPA fallback: non-API routes return index.html (client-side routing)
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 5000;

export const server: Server = app.listen(PORT, () => {
  console.log(`[INFO] KinesioLive Express Server running on port ${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[WARN] Port ${PORT} is already in use.`);
  } else {
    console.error('[ERROR] Server error:', err);
  }
});

export default app;
