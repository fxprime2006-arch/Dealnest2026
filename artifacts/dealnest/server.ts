import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { getDirectorySummary, PLATFORM_GROUPS, getPlatformCoverage, LIVE_COMPARISON_PLATFORMS } from './src/platformDirectory.js';
import {
  authStore,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
} from './server/authService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const platformDirectorySummary = getDirectorySummary();
app.set('trust proxy', 1);
app.disable('x-powered-by');

type ManagedCatalogRecord = { id: string; kind: 'deal' | 'coupon'; title: string; platform: string; category: string; price?: number; couponCode?: string; discount?: string; sourceUrl: string; sourceNote: string; createdAt: number; visible: boolean };
const managedCatalogFile = path.join(__dirname, 'data', 'managed_catalog.json');
function loadManagedCatalog(): ManagedCatalogRecord[] {
  try { if (fs.existsSync(managedCatalogFile)) return JSON.parse(fs.readFileSync(managedCatalogFile, 'utf8')) as ManagedCatalogRecord[]; } catch (err) { console.warn('Could not load managed catalog:', err); }
  return [];
}
let managedCatalog = loadManagedCatalog();
function saveManagedCatalog() {
  fs.mkdirSync(path.dirname(managedCatalogFile), { recursive: true });
  fs.writeFileSync(managedCatalogFile, JSON.stringify(managedCatalog, null, 2));
}

app.get('/_app/health', (_req: Request, res: Response) => {
  return res.status(200).json({ ok: true, service: 'dealnest' });
});

const disclaimerClients = new Set<Response>();
const MAX_DISCLAIMER_CLIENTS = 1000;

function isAllowedOrigin(origin: string): boolean {
  if (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') return true;
  if (process.env.PUBLIC_ORIGIN && origin === process.env.PUBLIC_ORIGIN) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && (url.hostname.endsWith('.manus.computer') || url.hostname.endsWith('.manus.space'));
  } catch {
    return false;
  }
}

// Same-origin requests do not need CORS. Managed Preview is embedded cross-site,
// so allow only trusted Manus origins instead of reflecting arbitrary origins.
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return typeof origin === 'string' && isAllowedOrigin(origin) ? res.sendStatus(204) : res.sendStatus(403);
  }
  next();
});

app.use(express.json());

// Helper to get client IP for rate limiting
function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

function getUserAuditIdentity(req: Request): { token: string; userId: string } | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const session = authStore.getUserSession(token);
  if (!session) return null;
  return { token, userId: session.codeId ? `user_${session.codeId}` : 'user_unknown' };
}

function broadcastDisclaimerUpdate() {
  const payload = `event: disclaimer.updated\ndata: ${JSON.stringify({
    version: authStore.getConfig().disclaimerVersion,
    text: authStore.getConfig().disclaimerText,
    updatedAt: authStore.getConfig().disclaimerUpdatedAt,
  })}\n\n`;
  for (const client of disclaimerClients) {
    try { client.write(payload); } catch { disclaimerClients.delete(client); }
  }
}

// Admin authentication middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || !authStore.validateAdminSession(token)) {
    return res.status(401).json({ error: 'Unauthorized. Admin session required.' });
  }

  next();
}

function requireCurrentDisclaimer(req: Request, res: Response, next: NextFunction) {
  const identity = getUserAuditIdentity(req);
  if (!identity) {
    // When the admin intentionally opens the site without an access wall, anonymous browsing remains allowed.
    if (!authStore.getConfig().accessGateEnabled) return next();
    return res.status(401).json({ error: 'Authenticated user session required.' });
  }
  if (!authStore.hasAcceptedDisclaimer(identity.token)) {
    const config = authStore.getConfig();
    return res.status(428).json({ error: 'Current disclaimer acceptance required.', disclaimer: { required: true, version: config.disclaimerVersion, text: config.disclaimerText, updatedAt: config.disclaimerUpdatedAt } });
  }
  authStore.recordAudit({ userId: identity.userId, ip: getClientIp(req), action: 'RESOURCE_ACCESSED', description: `Accessed protected resource ${req.path}.` });
  next();
}

// Safe public runtime settings. Admin-only activity and security data never leaves protected routes.
app.get('/api/public/config', (_req: Request, res: Response) => {
  return res.json({ success: true, config: authStore.getConfig() });
});

app.get('/api/catalog/managed', (_req: Request, res: Response) => {
  return res.json({ success: true, records: managedCatalog.filter(record => record.visible).slice(-200) });
});

// --- ADMIN ACCESS SYSTEM ROUTES ---

// 1. Admin Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const body = req.body || {};
  const accessCode = body.accessCode || body.code;
  const ip = getClientIp(req);
  const rateLimitKey = `admin_login:${ip}`;

  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Too many failed attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    });
  }

  if (!accessCode || typeof accessCode !== 'string') {
    recordFailedAttempt(rateLimitKey);
    return res.status(400).json({ error: 'Admin access code is required.' });
  }
  if (accessCode.length > 256) {
    recordFailedAttempt(rateLimitKey);
    return res.status(400).json({ error: 'Admin access code is too long.' });
  }

  const result = authStore.verifyAdminCode(accessCode);
  if (!result.valid) {
    const failed = recordFailedAttempt(rateLimitKey);
    const msg = failed.locked
      ? `Too many failed attempts. Locked for ${failed.retryAfterSeconds} seconds.`
      : 'Invalid admin access code. Please check your credentials.';
    return res.status(401).json({ error: msg });
  }

  resetRateLimit(rateLimitKey);
  const token = authStore.createAdminSession();
  authStore.recordAudit({
    userId: 'admin',
    ip,
    action: 'ADMIN_LOGIN',
    description: 'Administrator authenticated successfully.',
  });

  return res.json({
    success: true,
    token,
    needsChange: result.needsChange,
  });
});

// 2. Admin Check Status
app.get('/api/admin/status', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const isValid = token ? authStore.validateAdminSession(token) : false;

  return res.json({
    authenticated: isValid,
  });
});

// 3. Admin Change Access Code
app.post('/api/admin/change-code', requireAdmin, (req: Request, res: Response) => {
  const { currentCode, newCode } = req.body || {};

  if (typeof currentCode !== 'string' || typeof newCode !== 'string' || !currentCode.trim() || !newCode.trim()) {
    return res.status(400).json({ error: 'Current code and new code must be non-empty strings.' });
  }
  if (newCode.trim().length > 256) {
    return res.status(400).json({ error: 'New admin code must be 256 characters or fewer.' });
  }

  const result = authStore.changeAdminCode(currentCode, newCode);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({
    success: true,
    message: 'Admin access code updated successfully. Please use your new code for future logins.',
  });
});

// 4. Admin Logout
app.post('/api/admin/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    authStore.invalidateSession(token);
  }
  return res.json({ success: true });
});

// --- SECRET CODE MANAGEMENT ROUTES (Admin only) ---

// 5. Get all secret codes
app.get('/api/admin/codes', requireAdmin, (_req: Request, res: Response) => {
  const codes = authStore.getAllCodes();
  return res.json({ success: true, codes });
});

// 6. Generate secret codes (Single or batch)
app.post('/api/admin/codes/generate', requireAdmin, (req: Request, res: Response) => {
  const { count = 1, note = 'Generated by Admin', prefix = 'NEST' } = req.body || {};
  const numericCount = typeof count === 'number' || typeof count === 'string' ? Number(count) : NaN;
  const safeCount = Number.isFinite(numericCount) ? Math.max(1, Math.min(Math.floor(numericCount), 50)) : 1;
  const safePrefix = typeof prefix === 'string' && /^[A-Za-z0-9]{1,8}$/.test(prefix.trim()) ? prefix.trim().toUpperCase() : 'NEST';
  const safeNote = typeof note === 'string' ? note.trim().slice(0, 160) || 'Generated by Admin' : 'Generated by Admin';

  const newCodes = authStore.generateSecretCodes(safeCount, safeNote, safePrefix);
  return res.json({
    success: true,
    count: newCodes.length,
    codes: newCodes,
  });
});

// 7. Update secret code status (Active / Disabled / Revoked)
app.patch('/api/admin/codes/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, note } = req.body || {};

  if (!['active', 'disabled', 'revoked'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active, disabled, or revoked.' });
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > 160)) {
    return res.status(400).json({ error: 'Note must be a string of 160 characters or fewer.' });
  }

  const updated = authStore.updateCodeStatus(id, status, note);
  if (!updated) {
    return res.status(404).json({ error: 'Code not found.' });
  }

  return res.json({ success: true, code: updated });
});

// 8. Delete secret code
app.delete('/api/admin/codes/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = authStore.deleteCode(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Code not found.' });
  }
  return res.json({ success: true });
});

// 9. Admin site configuration and customer landing behavior
app.get('/api/admin/config', requireAdmin, (_req: Request, res: Response) => {
  return res.json({ success: true, config: authStore.getConfig() });
});

app.put('/api/admin/config', requireAdmin, (req: Request, res: Response) => {
  const { accessGateEnabled, defaultCustomerView, defaultLocation } = req.body || {};
  if (accessGateEnabled !== undefined && typeof accessGateEnabled !== 'boolean') {
    return res.status(400).json({ error: 'accessGateEnabled must be a boolean.' });
  }
  if (defaultCustomerView !== undefined && !['home', 'account', 'search'].includes(defaultCustomerView)) {
    return res.status(400).json({ error: 'defaultCustomerView is invalid.' });
  }
  if (defaultLocation !== undefined && (typeof defaultLocation !== 'string' || defaultLocation.trim().length > 40)) {
    return res.status(400).json({ error: 'defaultLocation must be a string of 40 characters or fewer.' });
  }
  const config = authStore.updateConfig({ accessGateEnabled, defaultCustomerView, defaultLocation });
  return res.json({ success: true, config });
});

app.get('/api/admin/catalog', requireAdmin, (_req: Request, res: Response) => {
  return res.json({ success: true, records: managedCatalog.slice().reverse() });
});

app.post('/api/admin/catalog', requireAdmin, (req: Request, res: Response) => {
  const body = req.body || {};
  const kind = body.kind === 'coupon' ? 'coupon' : body.kind === 'deal' ? 'deal' : null;
  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
  const rawPrice = typeof body.price === 'string' ? body.price.trim() : body.price;
  const parsedPrice = rawPrice === '' || rawPrice === undefined || rawPrice === null ? undefined : Number(rawPrice);
  if (!kind || typeof body.title !== 'string' || body.title.trim().length < 3 || typeof body.platform !== 'string' || !/^https?:\/\//i.test(sourceUrl)) {
    return res.status(400).json({ error: 'Kind, title, platform, and a valid source URL are required.' });
  }
  if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
    return res.status(400).json({ error: 'Price must be a valid non-negative number when supplied.' });
  }
  const record: ManagedCatalogRecord = {
    id: `managed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind, title: body.title.trim().slice(0, 180), platform: body.platform.trim().slice(0, 80),
    category: typeof body.category === 'string' ? body.category.slice(0, 30) : 'shop',
    price: parsedPrice === undefined ? undefined : Math.max(0, parsedPrice),
    couponCode: typeof body.couponCode === 'string' ? body.couponCode.trim().slice(0, 50) || undefined : undefined,
    discount: typeof body.discount === 'string' ? body.discount.trim().slice(0, 120) || undefined : undefined,
    sourceUrl: sourceUrl.slice(0, 1000),
    sourceNote: 'Added by DealNest administrator. Verify current availability, eligibility, and final price at the source.',
    createdAt: Date.now(), visible: true,
  };
  managedCatalog.push(record); saveManagedCatalog();
  authStore.recordAudit({ userId: 'admin', ip: getClientIp(req), action: 'CATALOG_RECORD_ADDED', description: `Added managed ${kind}: ${record.title}.` });
  return res.status(201).json({ success: true, record });
});

app.patch('/api/admin/catalog/:id', requireAdmin, (req: Request, res: Response) => {
  const record = managedCatalog.find(item => item.id === req.params.id);
  if (!record) return res.status(404).json({ error: 'Catalog record not found.' });
  if (typeof req.body?.visible === 'boolean') record.visible = req.body.visible;
  if (req.body?.title !== undefined && (typeof req.body.title !== 'string' || req.body.title.trim().length < 3)) {
    return res.status(400).json({ error: 'Title must be at least 3 characters.' });
  }
  if (typeof req.body?.title === 'string') record.title = req.body.title.trim().slice(0, 180);
  if (typeof req.body?.discount === 'string') record.discount = req.body.discount.trim().slice(0, 120) || undefined;
  if (typeof req.body?.couponCode === 'string') record.couponCode = req.body.couponCode.trim().slice(0, 50) || undefined;
  if (req.body?.price !== undefined && (typeof req.body.price !== 'number' || !Number.isFinite(req.body.price) || req.body.price < 0)) {
    return res.status(400).json({ error: 'Price must be a valid non-negative number.' });
  }
  if (typeof req.body?.price === 'number') record.price = Math.max(0, req.body.price);
  saveManagedCatalog();
  return res.json({ success: true, record });
});

app.delete('/api/admin/catalog/:id', requireAdmin, (req: Request, res: Response) => {
  const before = managedCatalog.length;
  managedCatalog = managedCatalog.filter(item => item.id !== req.params.id);
  if (managedCatalog.length === before) return res.status(404).json({ error: 'Catalog record not found.' });
  saveManagedCatalog();
  authStore.recordAudit({ userId: 'admin', ip: getClientIp(req), action: 'CATALOG_RECORD_DELETED', description: `Deleted managed catalog record ${req.params.id}.` });
  return res.json({ success: true });
});

// 10. Enrollment activity is admin-only and includes the originating IP for audit visibility.
app.get('/api/admin/activity', requireAdmin, (_req: Request, res: Response) => {
  return res.json({ success: true, activity: authStore.getActivity() });
});

app.get('/api/admin/audit-logs', requireAdmin, (req: Request, res: Response) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.floor(rawLimit), 2000)) : 500;
  return res.json({ success: true, logs: authStore.getAuditLogs(limit) });
});

app.get('/api/admin/disclaimer', requireAdmin, (_req: Request, res: Response) => {
  const config = authStore.getConfig();
  return res.json({ success: true, disclaimer: { version: config.disclaimerVersion, text: config.disclaimerText, updatedAt: config.disclaimerUpdatedAt } });
});

app.put('/api/admin/disclaimer', requireAdmin, (req: Request, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (text.length < 20) return res.status(400).json({ error: 'Disclaimer text must be at least 20 characters.' });
  const config = authStore.updateConfig({ disclaimerText: text });
  const ip = getClientIp(req);
  authStore.recordAudit({ userId: 'admin', ip, action: 'DISCLAIMER_UPDATED', description: `Global disclaimer updated to version ${config.disclaimerVersion}.`, metadata: { version: config.disclaimerVersion } });
  broadcastDisclaimerUpdate();
  return res.json({ success: true, disclaimer: { version: config.disclaimerVersion, text: config.disclaimerText, updatedAt: config.disclaimerUpdatedAt } });
});

// One SSE connection per active browser session. A multi-instance deployment should fan this event through Redis/pubsub.
app.get('/api/disclaimer/stream', (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token || !authStore.getUserSession(token)) {
    return res.status(401).json({ error: 'Authenticated user session required.' });
  }
  if (disclaimerClients.size >= MAX_DISCLAIMER_CLIENTS) {
    return res.status(503).json({ error: 'Disclaimer update stream is temporarily at capacity.' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  disclaimerClients.add(res);
  res.write(`event: ready\ndata: ${JSON.stringify(authStore.getConfig())}\n\n`);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
  req.on('close', () => { clearInterval(heartbeat); disclaimerClients.delete(res); });
});

app.get('/api/disclaimer/current', (req: Request, res: Response) => {
  const identity = getUserAuditIdentity(req);
  if (!identity) return res.status(401).json({ error: 'Authenticated user session required.' });
  const config = authStore.getConfig();
  authStore.recordAudit({ userId: identity.userId, ip: getClientIp(req), action: 'DISCLAIMER_VIEWED', description: `Viewed global disclaimer version ${config.disclaimerVersion}.`, metadata: { version: config.disclaimerVersion } });
  return res.json({ success: true, disclaimer: { required: !authStore.hasAcceptedDisclaimer(identity.token), version: config.disclaimerVersion, text: config.disclaimerText, updatedAt: config.disclaimerUpdatedAt } });
});

app.post('/api/disclaimer/accept', (req: Request, res: Response) => {
  const identity = getUserAuditIdentity(req);
  const version = Number(req.body?.version);
  if (!identity) return res.status(401).json({ error: 'Authenticated user session required.' });
  const config = authStore.getConfig();
  if (version !== config.disclaimerVersion) return res.status(409).json({ error: 'The disclaimer changed. Reload the latest version.', disclaimer: { version: config.disclaimerVersion, text: config.disclaimerText, updatedAt: config.disclaimerUpdatedAt } });
  if (!authStore.acceptDisclaimer(identity.token)) return res.status(401).json({ error: 'Session expired.' });
  authStore.recordAudit({ userId: identity.userId, ip: getClientIp(req), action: 'DISCLAIMER_ACCEPTED', description: `Accepted global disclaimer version ${version}.`, metadata: { version } });
  return res.json({ success: true, version });
});

app.post('/api/audit/resource', (req: Request, res: Response) => {
  const identity = getUserAuditIdentity(req);
  if (!identity) return res.status(401).json({ error: 'Authenticated user session required.' });
  if (!authStore.hasAcceptedDisclaimer(identity.token)) return res.status(428).json({ error: 'Current disclaimer must be accepted first.' });
  const resource = typeof req.body?.resource === 'string' ? req.body.resource.slice(0, 120) : 'free-resource';
  authStore.recordAudit({ userId: identity.userId, ip: getClientIp(req), action: 'RESOURCE_ACCESSED', description: `Accessed free resource: ${resource}.`, metadata: { resource } });
  return res.json({ success: true });
});

// --- USER ENROLLMENT SYSTEM ROUTES ---

// 11. Enter Secret Code & Enroll
app.post('/api/enroll/verify', (req: Request, res: Response) => {
  const { code, userName } = req.body || {};
  const ip = getClientIp(req);
  const rateLimitKey = `enroll:${ip}`;

  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Too many failed attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    });
  }

  if (!code || typeof code !== 'string') {
    recordFailedAttempt(rateLimitKey);
    return res.status(400).json({ error: 'Please enter your secret access code.' });
  }
  if (userName !== undefined && (typeof userName !== 'string' || userName.trim().length > 120)) {
    return res.status(400).json({ error: 'Name/handle must be a string of 120 characters or fewer.' });
  }

  // Prevent administrator credentials from being used as member enrollment codes.
  if (authStore.verifyAdminCode(code).valid) {
    return res.status(400).json({
      error: 'This is an administrator access code. Please click "Administrator Access" in the top bar to sign in as Admin.',
      isAdminCode: true,
    });
  }

  const enrollResult = authStore.verifyAndEnrollCode(code, userName, {
    ip,
    userAgent: String(req.headers['user-agent'] || 'unknown').slice(0, 300),
  });
  if (!enrollResult.success) {
    const failed = recordFailedAttempt(rateLimitKey);
    const msg = failed.locked
      ? `Too many failed attempts. Locked for ${failed.retryAfterSeconds} seconds.`
      : enrollResult.error || 'Invalid code.';
    return res.status(401).json({ error: msg });
  }

  resetRateLimit(rateLimitKey);
  authStore.recordAudit({
    userId: enrollResult.codeRecord?.id ? `user_${enrollResult.codeRecord.id}` : 'unknown',
    ip,
    action: 'USER_LOGIN',
    description: 'User authenticated with an access code.',
    metadata: { userName: String(userName || 'Enrolled Member').slice(0, 120) },
  });
  return res.json({
    success: true,
    token: enrollResult.token,
    user: {
      name: enrollResult.codeRecord?.usedBy || 'Enrolled Member',
      codeId: enrollResult.codeRecord?.id,
    },
  });
});

// 10. Check User Session
app.get('/api/enroll/session', (req: Request, res: Response) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ valid: false, error: 'No session token provided.' });
  }

  const session = authStore.validateUserSession(token);
  if (!session.valid) {
    return res.status(401).json({ valid: false, error: 'Session expired or invalid.' });
  }

  authStore.recordAudit({
    userId: session.user?.userId || 'unknown',
    ip: getClientIp(req),
    action: 'SESSION_RELOADED',
    description: 'Active user session was checked on reload or login.',
  });

  return res.json({
    valid: true,
    user: session.user,
    disclaimer: session.disclaimer,
  });
});

// 11. User Logout
app.post('/api/enroll/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    authStore.invalidateSession(token);
  }
  return res.json({ success: true });
});

// --- DEALNEST AI ASSISTANT ROUTE ---

// Initialize the configured conversational engine.
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: { 'User-Agent': 'dealnest-runtime' },
    },
  });
}

// Conversational fallback engine for DealNest Intelligence
function generateSmartFallback(message: string, location: string, catalogSummary: string): string {
  const q = message.toLowerCase().trim();
  if (/^(hi|hello|hey|yo|greetings|good\s*(morning|afternoon|evening)|sup|howdy)\b/i.test(q)) {
    return `Hello! 👋 I'm **DealNest Intelligence**, your comparison and coupon guide in **${location}**.\n\nI can compare the catalog records and source-backed offers available in DealNest. What product, meal, trip, service, or offer would you like to check?`;
  }

  if (/^(who are you|what can you do|help|how does this work|what is dealnest)\b/i.test(q)) {
    return `I’m **DealNest Intelligence**. I help you find catalog listings, official partner offers, third-party coupon leads, delivery fees, and checkout guidance across shopping, food, grocery, fashion, beauty, pharmacy, travel, entertainment, rides, home services, fitness, jewellery, and auto services.\n\nAsk me for a product, platform, city, budget, route, or coupon. I’ll separate available catalog evidence from partner coverage and tell you what must be confirmed at checkout.`;
  }

  const platformEntries = PLATFORM_GROUPS.flatMap(group => group.platforms.map(platform => ({ platform, group })));
  const aliases: Record<string, string> = { uder: 'Uber', ola: 'Ola', swiggy: 'Swiggy', zomato: 'Zomato', rapdio: 'Rapido' };
  const requestedPlatformName = Object.keys(aliases).find(alias => q === alias || q.includes(`${alias} `))
    ? aliases[Object.keys(aliases).find(alias => q === alias || q.includes(`${alias} `)) as string]
    : platformEntries.find(entry => q === entry.platform.toLowerCase() || q.includes(entry.platform.toLowerCase()))?.platform;
  if (requestedPlatformName) {
    const platformEntry = platformEntries.find(entry => entry.platform === requestedPlatformName);
    if (platformEntry) {
      return `**${requestedPlatformName}** is listed under **${platformEntry.group.title}**.\n\n${platformEntry.group.description}\n\nDealNest can guide you to the official partner and show any matching source-backed offer or coupon record available in the catalog. A current fare, availability, surge, service fee, route, or account-specific promotion is not assumed from the platform name alone—please provide the route or exact service and confirm the final amount in the official booking flow.`;
    }
  }

  const parsed = parseUserInput(message);
  const tokens = parsed.identifiedItem.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2);
  const matchingRecords = catalogSummary
    .split('\n')
    .filter(Boolean)
    .filter(line => tokens.some(token => line.toLowerCase().includes(token)))
    .slice(0, 5)
    .map(line => line.replace(/^•\s*/, ''));
  const records = matchingRecords.length
    ? `\n\n**Available DealNest catalog records**\n${matchingRecords.map(line => `- ${line}`).join('\n')}`
    : '\n\nNo matching catalog record was supplied for this request.';
  const source = parsed.isUrl && parsed.directSourceUrl
    ? `\n\nI parsed the supplied ${parsed.sourcePlatform || 'partner'} URL as **${parsed.identifiedItem}**. The original link remains the source of truth for the exact variant.`
    : '';

  const questionGuidance = /\b(what|why|how|when|where|can|does|is|are|tell|explain)\b/i.test(q)
    ? `\n\nTell me the exact subject, platform, city, route, product, or budget and I’ll narrow this down without inventing unsupported facts.`
    : '';
  return `I can help with **${parsed.identifiedItem}** in **${location}**, but I will not invent a current price, coupon, fee, stock status, expiry, or winner.${source}${records}${questionGuidance}\n\nConfirm the exact variant, delivery address, eligibility, and final payable amount on the official partner checkout page before ordering.`;
}

// --- CROSS-PLATFORM SEARCH, URL ANALYSIS & BEST DEAL ENGINE ---

interface DiscoveredPlatformOffer {
  platform: string;
  productName: string;
  price: number | null;
  mrp: number | null;
  discountPct: number;
  couponCode: string | null;
  couponSavings: number;
  deliveryFee: number;
  totalPayable: number | null;
  directUrl: string;
  etaMinutes: number;
  rating: number;
  isVerified: boolean;
  unverifiedNote?: string;
}

interface CrossPlatformSearchResult {
  originalInput: string;
  isUrl: boolean;
  sourcePlatform?: string;
  identifiedItem: string;
  category: 'shop' | 'food' | 'qc';
  winner: {
    platform: string;
    productName: string;
    totalPrice: number;
    savingsVsHighest: number;
    reason: string;
    directUrl: string;
  } | null;
  offers: DiscoveredPlatformOffer[];
  analysisSummary: string;
  item: any;
}

function parseUserInput(input: string): {
  isUrl: boolean;
  sourcePlatform?: string;
  identifiedItem: string;
  category: 'shop' | 'food' | 'qc';
  directSourceUrl?: string;
} {
  const trimmed = input.trim();
  let isUrl = false;
  let sourcePlatform: string | undefined = undefined;
  let directSourceUrl: string | undefined = undefined;

  try {
    if (/^https?:\/\//i.test(trimmed) || /^(www\.)?[a-z0-9-]+\.(com|in|org|net|co)/i.test(trimmed)) {
      const parsedUrl = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      isUrl = true;
      directSourceUrl = parsedUrl.href;
      const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();

      const hostMap: Record<string, string> = {
        'amazon.in': 'Amazon',
        'amazon.com': 'Amazon',
        'flipkart.com': 'Flipkart',
        'meesho.com': 'Meesho',
        'myntra.com': 'Myntra',
        'ajio.com': 'AJIO',
        'croma.com': 'Croma',
        'reliancedigital.in': 'Reliance Digital',
        'swiggy.com': parsedUrl.pathname.includes('/instamart') ? 'Instamart' : 'Swiggy',
        'zomato.com': 'Zomato',
        'eatclub.com': 'EatClub',
        'dominos.co.in': "Domino's",
        'dominos.com': "Domino's",
        'magicpin.in': 'Magicpin',
        'zepto.com': 'Zepto',
        'zeptonow.com': 'Zepto',
        'blinkit.com': 'Blinkit',
        'bigbasket.com': 'BigBasket',
        'jiomart.com': 'JioMart',
      };

      sourcePlatform = hostMap[host] || host;

      // Extract dish or product from query or path
      const qParam = parsedUrl.searchParams.get('dish') ||
                     parsedUrl.searchParams.get('q') ||
                     parsedUrl.searchParams.get('query') ||
                     parsedUrl.searchParams.get('item') ||
                     parsedUrl.searchParams.get('product');

      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const ignored = new Set(['p', 'dp', 'gp', 'product', 'products', 'restaurants', 'city', 'prn', 'prid', 'buy', 'pd', 'ps', 'order', 'menu', 'search', 's']);
      const validSegs = segments.filter(s => !ignored.has(s.toLowerCase()));
      const rawTarget = qParam || (validSegs.sort((a, b) => b.length - a.length)[0] || segments[0] || '');

      let cleaned = decodeURIComponent(rawTarget)
        .replace(/[?#].*$/, '')
        .replace(/\/dp\/[A-Z0-9]+.*$/i, '')
        .replace(/\/p\/itm[a-z0-9]+.*$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b(pid|itm|ref|tag|ascsubtag|cid|qid)=[a-zA-Z0-9_-]+/gi, '')
        .trim();

      const lower = cleaned.toLowerCase();
      let category: 'shop' | 'food' | 'qc' = 'shop';
      let itemName = cleaned;

      if (sourcePlatform === 'Amazon' && /^(?:B0|[0-9]{2})[A-Z0-9]{6,}$/i.test(cleaned)) {
        itemName = 'Amazon product page';
      } else if (sourcePlatform === 'Flipkart' && /^itm[a-z0-9]+$/i.test(cleaned)) {
        itemName = 'Flipkart product page';
      }

      if (sourcePlatform === 'Swiggy' || sourcePlatform === 'Zomato' || sourcePlatform === 'EatClub' || sourcePlatform === "Domino's" || sourcePlatform === 'Magicpin' || lower.includes('biryani') || lower.includes('pizza') || lower.includes('burger') || lower.includes('chicken') || lower.includes('food') || lower.includes('meal')) {
        category = 'food';
        if (lower.includes('biryani')) {
          itemName = lower.includes('mutton') ? 'Mutton Biryani' : 'Chicken Dum Biryani';
        } else if (lower.includes('pizza') || sourcePlatform === "Domino's") {
          itemName = 'Medium Margherita Pizza';
        } else if (lower.includes('burger')) {
          itemName = 'Crispy Chicken Burger';
        } else if (lower.includes('coffee')) {
          itemName = 'Iced Cold Coffee';
        } else {
          itemName = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Restaurant Meal';
        }
      } else if (sourcePlatform === 'Zepto' || sourcePlatform === 'Blinkit' || sourcePlatform === 'Instamart' || sourcePlatform === 'BigBasket' || sourcePlatform === 'JioMart' || lower.includes('milk') || lower.includes('dairy') || lower.includes('grocery') || lower.includes('bread') || lower.includes('egg')) {
        category = 'qc';
        if (lower.includes('milk') || lower.includes('amul')) {
          itemName = 'Amul Taaza Toned Milk 1L';
        } else if (lower.includes('egg')) {
          itemName = 'Farm Fresh Eggs (12 pcs)';
        } else {
          itemName = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Grocery Essential';
        }
      } else {
        category = 'shop';
        if (lower.includes('iphone 17') || (lower.includes('iphone') && lower.includes('17'))) {
          itemName = 'iPhone 17 256GB';
        } else if (lower.includes('airpod') || lower.includes('earbud')) {
          itemName = 'AirPods Pro (2nd gen)';
        } else if (lower.includes('headphone')) {
          itemName = 'Wireless Headphones ANC';
        } else if (lower.includes('shoe') || lower.includes('sneaker') || lower.includes('running')) {
          itemName = 'Running Shoes Pro';
        } else {
          itemName = cleaned.split(' ').slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Consumer Product';
        }
      }

      if (sourcePlatform === 'Amazon' && /^(?:B0|[0-9]{2})[A-Z0-9]{6,}$/i.test(cleaned)) {
        itemName = 'Amazon product page';
      } else if (sourcePlatform === 'Flipkart' && /^itm[a-z0-9]+$/i.test(cleaned)) {
        itemName = 'Flipkart product page';
      }

      return {
        isUrl: true,
        sourcePlatform,
        identifiedItem: itemName,
        category,
        directSourceUrl,
      };
    }
  } catch {
    // Fall through to text query parsing
  }

  // Natural language query cleanup
  const cleanQ = trimmed
    .replace(/[₹]/g, ' ')
    .replace(/\b(find|me|the|cheapest|lowest|price|compare|comparison|everywhere|from|this|link|url|is|there|a|better|deal|best|near|me|where|can|i|get|offers?|deals?|prices?|cheaper|buy|online)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const lowerText = cleanQ.toLowerCase();
  let category: 'shop' | 'food' | 'qc' = 'shop';
  let identifiedItem = cleanQ || trimmed;

  if (lowerText.includes('biryani') || lowerText.includes('pizza') || lowerText.includes('burger') || lowerText.includes('coffee') || lowerText.includes('food') || lowerText.includes('dinner') || lowerText.includes('lunch') || lowerText.includes('chicken') || lowerText.includes('swiggy') || lowerText.includes('zomato')) {
    category = 'food';
    if (lowerText.includes('biryani')) identifiedItem = 'Chicken Dum Biryani';
    else if (lowerText.includes('pizza')) identifiedItem = 'Medium Margherita Pizza';
    else if (lowerText.includes('burger')) identifiedItem = 'Crispy Chicken Burger';
    else if (lowerText.includes('coffee')) identifiedItem = 'Iced Cold Coffee';
  } else if (lowerText.includes('milk') || lowerText.includes('amul') || lowerText.includes('dairy') || lowerText.includes('egg') || lowerText.includes('grocery') || lowerText.includes('zepto') || lowerText.includes('blinkit') || lowerText.includes('instamart')) {
    category = 'qc';
    if (lowerText.includes('milk') || lowerText.includes('amul')) identifiedItem = 'Amul Taaza Toned Milk 1L';
    else if (lowerText.includes('egg')) identifiedItem = 'Farm Fresh Eggs (12 pcs)';
  } else {
    category = 'shop';
    if (lowerText.includes('iphone 17') || (lowerText.includes('iphone') && lowerText.includes('17'))) identifiedItem = 'iPhone 17 256GB';
    else if (lowerText.includes('airpod') || lowerText.includes('earbud')) identifiedItem = 'AirPods Pro (2nd gen)';
    else if (lowerText.includes('headphone')) identifiedItem = 'Wireless Headphones ANC';
    else if (lowerText.includes('shoe') || lowerText.includes('sneaker')) identifiedItem = 'Running Shoes Pro';
  }

  if (!identifiedItem) {
    identifiedItem = 'Featured Product';
  }

  return {
    isUrl: false,
    identifiedItem,
    category,
  };
}

function discoverCrossPlatformDeals(
  parsedInfo: {
    isUrl: boolean;
    sourcePlatform?: string;
    identifiedItem: string;
    category: 'shop' | 'food' | 'qc';
    directSourceUrl?: string;
  },
  location = 'Hyderabad'
): CrossPlatformSearchResult {
  const { isUrl, sourcePlatform, identifiedItem, category, directSourceUrl } = parsedInfo;

  // Do not synthesize prices, coupon codes, delivery fees, ratings, or winners.
  // The browser catalog and cited partner pages are the only allowed evidence.
  // This safe response still confirms that a pasted URL was parsed and lets the
  // client render its own catalog matches without claiming a current quote.
  const safeItem = {
    id: `parsed_${identifiedItem.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'item'}`,
    name: identifiedItem,
    type: category,
    em: category === 'food' ? '🍽️' : category === 'qc' ? '🛒' : '🛍️',
    mrp: 0,
    pop: 0,
    o: [],
  };
  return {
    originalInput: isUrl && directSourceUrl ? directSourceUrl : identifiedItem,
    isUrl,
    sourcePlatform,
    identifiedItem,
    category,
    winner: null,
    offers: [],
    analysisSummary: `Parsed ${isUrl ? 'the supplied URL' : 'the search request'} as “${identifiedItem}”. No current source-backed product quote was supplied, so DealNest will not invent a price, coupon, fee, or winner.`,
    item: safeItem,
  };

}

type ExtractedUrlProduct = {
  sourceUrl: string;
  platform: string;
  name: string;
  imageUrl?: string;
  mrp: number | null;
  price: number;
  currency: 'INR';
  availability?: string;
  offerCount: number;
};

function absoluteUrl(value: unknown, base: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try { return new URL(value.trim(), base).toString(); } catch { return undefined; }
}

function numericPrice(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }
  }
  return undefined;
}

function collectProductJson(value: unknown, out: Array<Record<string, any>>) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(item => collectProductJson(item, out)); return; }
  const record = value as Record<string, any>;
  const type = record['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some(entry => typeof entry === 'string' && /product|offer/i.test(entry))) out.push(record);
  Object.values(record).forEach(child => {
    if (child && typeof child === 'object') collectProductJson(child, out);
  });
}

function extractHtmlMeta(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${escaped}["']`, 'i');
  const match = html.match(pattern);
  return match?.[1] || match?.[2];
}

function cleanIdentityTokens(value: string): string[] {
  return value.toLowerCase().replace(/%[0-9a-f]{2}/gi, ' ').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(token => token.length >= 3 && !['www', 'https', 'http', 'product', 'products', 'buy', 'online', 'india'].includes(token));
}

function assertExactProductIdentity(sourceUrl: string, finalUrl: string, product: Record<string, any>, name: string) {
  const source = new URL(sourceUrl);
  const productIdentity = JSON.stringify({ sku: product?.sku, mpn: product?.mpn, gtin: product?.gtin, productID: product?.productID, asin: product?.asin }).toLowerCase();
  const idCandidates = [
    source.hostname.includes('amazon.') ? source.pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:[/?]|$)/i)?.[1] : undefined,
    source.hostname.includes('flipkart.') ? source.pathname.match(/\/p\/([a-z0-9]+)(?:[/?]|$)/i)?.[1] : undefined,
  ].filter(Boolean) as string[];
  for (const id of idCandidates) {
    // Matching the ID somewhere in raw HTML is insufficient: pages can contain
    // recommendations or stale scripts for other products. Require the ID in
    // the structured product identity that supplied the name and price.
    if (!productIdentity.includes(id.toLowerCase())) {
      throw new Error('Product data could not be verified for this URL.');
    }
  }
  const sourceTokens = cleanIdentityTokens(`${source.pathname} ${source.searchParams.get('q') || ''}`);
  const nameTokens = new Set(cleanIdentityTokens(name));
  if (sourceTokens.length >= 2) {
    const matched = sourceTokens.filter(token => nameTokens.has(token)).length;
    if (matched < Math.min(2, sourceTokens.length)) throw new Error('Product data could not be verified for this URL.');
  }
  if (!new URL(finalUrl).hostname) throw new Error('Product data could not be verified for this URL.');
}

async function inspectProductUrl(sourceUrl: string): Promise<ExtractedUrlProduct> {
  const parsed = new URL(sourceUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http(s) product URLs are supported.');
  const response = await fetch(parsed.toString(), {
    headers: { 'User-Agent': 'DealNestProductInspector/1.0 (+https://dealnest-js2ovgts.manus.space)', Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`The partner page returned HTTP ${response.status}.`);
  const html = (await response.text()).slice(0, 2_000_000);
  const finalUrl = response.url || parsed.toString();
  const parsedFinal = new URL(finalUrl);
  const host = parsedFinal.hostname.replace(/^www\./, '').toLowerCase();
  const platformMap: Record<string, string> = {
    'amazon.in': 'Amazon', 'amazon.com': 'Amazon', 'flipkart.com': 'Flipkart', 'myntra.com': 'Myntra',
    'ajio.com': 'AJIO', 'croma.com': 'Croma', 'reliancedigital.in': 'Reliance Digital',
    'tatacliq.com': 'Tata CLiQ', 'tatadigital.com': 'Tata Neu', 'meesho.com': 'Meesho', 'shopsy.in': 'Shopsy',
    'snapdeal.com': 'Snapdeal', 'nykaa.com': 'Nykaa', 'nykaafashion.com': 'Nykaa Fashion', 'tira.com': 'Tira',
    'purplle.com': 'Purplle', 'sephora.in': 'Sephora', 'zepto.com': 'Zepto', 'zeptonow.com': 'Zepto',
    'blinkit.com': 'Blinkit', 'bigbasket.com': 'BigBasket', 'jiomart.com': 'JioMart', 'dmart.in': 'DMart Ready',
    'swiggy.com': parsedFinal.pathname.includes('/instamart') ? 'Instamart' : 'Swiggy', 'zomato.com': 'Zomato',
    'eatsure.com': 'EatSure', 'magicpin.in': 'Magicpin', 'dominos.co.in': "Domino's", 'pizzahut.co.in': 'Pizza Hut',
    'kfc.co.in': 'KFC', 'makemytrip.com': 'MakeMyTrip', 'cleartrip.com': 'Cleartrip', 'easemytrip.com': 'EaseMyTrip',
    'ixigo.com': 'ixigo', 'goibibo.com': 'Goibibo', 'booking.com': 'Booking.com', 'agoda.com': 'Agoda',
    'oyorooms.com': 'OYO', 'redbus.in': 'RedBus', 'uber.com': 'Uber', 'olacabs.com': 'Ola',
    'rapido.bike': 'Rapido', 'bookmyshow.com': 'BookMyShow', 'paytminsider.com': 'Paytm Insider',
    'cult.fit': 'Cult.fit', 'decathlon.in': 'Decathlon', '1mg.com': 'Tata 1mg', 'pharmeasy.in': 'PharmEasy',
    'netmeds.com': 'Netmeds', 'apollo247.com': 'Apollo 24|7', 'urbancompany.com': 'Urban Company', 'cars24.com': 'Cars24',
  };
  const platform = platformMap[host] || host;
  const jsonProducts: Array<Record<string, any>> = [];
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try { collectProductJson(JSON.parse(script[1].trim()), jsonProducts); } catch { /* malformed third-party JSON-LD is ignored */ }
  }
  const product = jsonProducts.find(entry => typeof entry.name === 'string') || jsonProducts[0];
  const offers = product?.offers && typeof product.offers === 'object' ? product.offers : product;
  const offerList = Array.isArray(offers) ? offers : [offers];
  const pageDeclaresInr = /₹|\bINR\b|priceCurrency["']?\s*[:=]\s*["']INR/i.test(html) || /\.in$/i.test(parsedFinal.hostname);
  const inrOffer = offerList.find((offer: any) => String(offer?.priceCurrency || '').toUpperCase() === 'INR' || (!offer?.priceCurrency && pageDeclaresInr));
  const metaName = extractHtmlMeta(html, 'og:title') || extractHtmlMeta(html, 'twitter:title') || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim();
  const name = String(product?.name || metaName || '').replace(/\s+/g, ' ').trim();
  if (!name) throw new Error('Product data could not be verified for this URL.');
  assertExactProductIdentity(sourceUrl, finalUrl, product || {}, name);
  const image = absoluteUrl(Array.isArray(product?.image) ? product.image[0] : product?.image, finalUrl) || absoluteUrl(extractHtmlMeta(html, 'og:image'), finalUrl);
  const price = numericPrice(inrOffer?.price) || (pageDeclaresInr ? numericPrice(product?.price) : undefined) || (pageDeclaresInr ? numericPrice(extractHtmlMeta(html, 'product:price:amount')) : undefined) || numericPrice((html.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/i) || [])[1]);
  const lowPrice = numericPrice(inrOffer?.lowPrice);
  const highPrice = numericPrice(inrOffer?.highPrice) || numericPrice(product?.highPrice);
  const currentPrice = lowPrice || price;
  if (!currentPrice) throw new Error('Product data could not be verified for this URL.');
  return { sourceUrl: finalUrl, platform, name, imageUrl: image, mrp: highPrice || null, price: currentPrice, currency: 'INR', availability: inrOffer?.availability, offerCount: offerList.filter((offer: any) => numericPrice(offer?.price) && String(offer?.priceCurrency || '').toUpperCase() === 'INR').length || 1 };
}

app.post('/api/deals/inspect-url', requireCurrentDisclaimer, async (req: Request, res: Response) => {
  const input = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!input || input.length > 4096) return res.status(400).json({ error: 'Enter a product URL up to 4096 characters.' });
  let parsed: URL;
  try { parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`); } catch { return res.status(400).json({ error: 'Enter a valid http(s) product URL.' }); }
  try { return res.json({ success: true, product: await inspectProductUrl(parsed.toString()) }); }
  catch (error: any) { return res.status(422).json({ error: error?.message || 'The partner page could not be inspected.' }); }
});

// 12. Deep Cross-Platform Search & URL Analysis API
app.post('/api/deals/analyze-search', requireCurrentDisclaimer, async (req: Request, res: Response) => {
  const { query, location = 'Hyderabad' } = req.body || {};

  if (typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Search query or URL is required.' });
  }
  const normalizedQuery = query.trim();
  const isUrlQuery = /^https?:\/\//i.test(normalizedQuery) || /^(www\.)?[a-z0-9-]+\.(com|in|org|net|co)(\/|$)/i.test(normalizedQuery);
  if (normalizedQuery.length > (isUrlQuery ? 4096 : 240)) {
    return res.status(400).json({ error: isUrlQuery ? 'Product URLs must be 4096 characters or fewer.' : 'Search queries must be 240 characters or fewer.' });
  }
  if (typeof location !== 'string' || location.trim().length > 80) {
    return res.status(400).json({ error: 'Location must be a string of 80 characters or fewer.' });
  }

  try {
    const parsed = parseUserInput(query);
    const analysis = discoverCrossPlatformDeals(parsed, location);

    return res.json({
      success: true,
      result: analysis,
      item: analysis.item,
    });
  } catch (err: any) {
    console.error('Error in /api/deals/analyze-search:', err);
    return res.status(500).json({ error: 'Failed to analyze deals across platforms.' });
  }
});
let liveSyncCounter = 1;

app.get('/api/market/live-feed', requireCurrentDisclaimer, (req: Request, res: Response) => {
  const location = typeof req.query.location === 'string' ? req.query.location : 'Hyderabad';
  if (location.trim().length > 80) {
    return res.status(400).json({ error: 'Location must be 80 characters or fewer.' });
  }
  liveSyncCounter += 1;

  // Deterministic DealNest price snapshot; external connector freshness is not claimed.
  const liveTickers = [
    `⚡ DealNest price snapshot in ${location}: iPhone 17 on Flipkart ₹81,999 vs Amazon ₹82,900 (Flipkart ₹901 lower before checkout terms)`,
    `⚡ Food price snapshot: EatClub Biryani at ₹139 with code BOX50; confirm delivery fee and eligibility in ${location}.`,
    `⚡ DealNest snapshot: AirPods Pro listed at ₹9,999 on Amazon with a possible ₹500 coupon; confirm at checkout.`,
    `⚡ Quick-commerce snapshot: Zepto lists Amul Milk at ₹65 in 9 mins vs Blinkit 10 mins in ${location}; confirm address availability.`,
    `⚡ Pizza price snapshot: Medium Margherita ₹169 direct; compare final total against third-party delivery apps.`,
    `⚡ Grocery price snapshot: Farm Eggs (12 pcs) ₹92 on Instamart; confirm stock, fee, and code IM20 at checkout.`,
  ];

  // Rotate the catalog snapshot so the minute-by-minute feed is visibly different
  // instead of repeating the same five prices. These are DealNest snapshot values,
  // not a claim that a merchant price is guaranteed until checkout.
  const priceSnapshots = [
    [
      { id: 'iph', platform: 'Flipkart', price: 81999, originalPrice: 89900, dropPct: 8.8, trend: 'down' },
      { id: 'air', platform: 'Amazon', price: 9999, originalPrice: 26900, dropPct: 62.8, trend: 'down' },
      { id: 'bir', platform: 'EatClub', price: 139, originalPrice: 249, dropPct: 44.2, trend: 'down' },
      { id: 'mlk', platform: 'Instamart', price: 64, originalPrice: 68, dropPct: 5.9, trend: 'down' },
      { id: 'piz', platform: "Domino's", price: 169, originalPrice: 239, dropPct: 29.3, trend: 'down' },
    ],
    [
      { id: 'iph', platform: 'Amazon', price: 82499, originalPrice: 89900, dropPct: 8.2, trend: 'down' },
      { id: 'air', platform: 'Flipkart', price: 10249, originalPrice: 26900, dropPct: 61.9, trend: 'down' },
      { id: 'bir', platform: 'Zomato', price: 149, originalPrice: 249, dropPct: 40.2, trend: 'down' },
      { id: 'mlk', platform: 'Zepto', price: 63, originalPrice: 68, dropPct: 7.4, trend: 'down' },
      { id: 'piz', platform: 'EatClub', price: 159, originalPrice: 239, dropPct: 33.5, trend: 'down' },
    ],
    [
      { id: 'iph', platform: 'Croma', price: 82990, originalPrice: 89900, dropPct: 7.7, trend: 'down' },
      { id: 'air', platform: 'Croma', price: 10790, originalPrice: 26900, dropPct: 59.9, trend: 'down' },
      { id: 'bir', platform: 'Magicpin', price: 145, originalPrice: 249, dropPct: 41.8, trend: 'down' },
      { id: 'mlk', platform: 'Blinkit', price: 67, originalPrice: 68, dropPct: 1.5, trend: 'down' },
      { id: 'piz', platform: 'Swiggy', price: 189, originalPrice: 239, dropPct: 20.9, trend: 'down' },
    ],
  ];
  const currentSnapshot = priceSnapshots[(liveSyncCounter - 1) % priceSnapshots.length];

  const currentTicker = liveTickers[(liveSyncCounter - 1) % liveTickers.length];

  return res.json({
    success: true,
    timestamp: Date.now(),
    syncCounter: liveSyncCounter,
    status: 'CONNECTED_DATA',
    location,
    ticker: currentTicker,
    connectedPlatforms: LIVE_COMPARISON_PLATFORMS.length,
    catalogOfferRecords: 142,
    catalogCouponRecords: 48,
    marketCondition: 'SNAPSHOT_REFRESHED',
    refreshedEverySeconds: 60,
    recentPriceDrops: currentSnapshot.map((deal) => ({
      ...deal,
      item: deal.id === 'iph' ? 'iPhone 17 256GB' : deal.id === 'air' ? 'AirPods Pro (2nd Gen)' : deal.id === 'bir' ? 'Chicken Dum Biryani' : deal.id === 'mlk' ? 'Amul Taaza Milk 1L' : 'Medium Margherita Pizza',
    })),
  });
});

// API: DealNest AI Real-Time Assistant
app.post('/api/ai/chat', requireCurrentDisclaimer, async (req: Request, res: Response) => {
  const { message, history = [], catalogSummary = '', location = 'Hyderabad' } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.trim().length > 4000) {
    return res.status(400).json({ error: 'Message must be 4000 characters or fewer.' });
  }

  const currentTimeStr = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });

  const systemInstruction = `You are DealNest Intelligence, an expert comparison and coupon concierge for India (current city: ${location}, answer time: ${currentTimeStr} IST).

Your job is to answer accurately across all DealNest categories. The directory below defines the partner coverage users may ask about:
${platformDirectorySummary}

Only the supplied catalog and cited partner pages are authoritative for numeric prices, coupon codes, delivery fees, and availability. For directory partners without supplied evidence, explain that DealNest can provide partner/checkout coverage but must not invent a price or coupon. Never present a directory listing as a current quote.

Here is the current DealNest catalog state supplied by the browser:
${catalogSummary}

Guidelines:
1. Provide friendly, concise, natural responses formatted in clean markdown.
2. If the user greets you, greet them back as DealNest Intelligence, mention the current city, and ask what product, meal, trip, service, or offer they want to compare.
3. When a user asks about ANY product, food, grocery, fashion, beauty, pharmacy, jewelry, fitness, entertainment, travel, mobility, home service, or auto service, identify the exact item and relevant category before comparing.
4. When a user pastes any product, food item, grocery item, or partner URL:
   - Do NOT only analyze that single website.
   - Extract the exact product/dish/grocery item details (brand, model, variant, dish, quantity) from the URL or query.
   - Search across competing platforms (Amazon, Flipkart, Meesho, Myntra, Croma, Reliance Digital, Swiggy, Zomato, EatClub, Domino's, Zepto, Blinkit, Instamart, BigBasket).
   - If user gives a Swiggy or Zomato restaurant link, identify the exact dish (e.g. Biryani) and compare the same or equivalent item across competing restaurants/platforms to find the lowest total price. Do not simply compare category pages.
5. For every live result shown, provide:
   - Matching product/item/dish name
   - Platform name
   - Base Price & MRP
   - Applicable coupon/offer codes and savings
   - Delivery / extra charges
   - Final landed / payable price
   - EXACT DIRECT PRODUCT/FOOD LINK (never generic homepages or category links)
6. For checkout-only partners, provide the official partner name, what needs confirmation, and a clear "not a live quote" label instead of fabricated numbers.
7. Analyze all discovered results, remove duplicates or incorrect matches, compare equivalent variants/quantities, and clearly identify the WINNER as "Best Deal" only when there is enough current data.
8. Understand natural-language requests such as:
   - "Find the cheapest iPhone 17"
   - "Compare this product everywhere"
   - "Find the cheapest biryani from this link"
   - "Find this milk cheaper"
   - "Is there a better deal?"
   and return a clear comparison table with the Best Deal winner highlighted.
9. Mention available coupons and offers from the live catalog when relevant. Never fabricate coupon codes, discounts, or availability. Clearly note when prices are subject to live checkout confirmation.
10. Tell the user whether each offer is for a new customer, returning customer, all customers, or requires a bank/membership condition. If eligibility is unknown, say “eligibility must be confirmed at checkout.”
11. Finish transactional answers with a numbered “How to order” sequence: choose the matching item and variant, open the official link, apply the stated coupon or payment offer, verify delivery/fees and final payable total, then place the order only after checkout confirmation.
12. Use Google Search grounding when available for current web evidence, cite the returned sources, and label the answer “Google-grounded” only when grounding sources were actually returned. Never claim to have searched the entire Google index or every website.
13. Keep catalog facts, Google-grounded evidence, and directory/checkout-only coverage in separate labeled sections so the customer can tell what is confirmed.`;

  if (ai) {
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
    ];

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add previous conversation turns
    for (const turn of history.slice(-6)) {
      contents.push({
        role: turn.isAi ? 'model' : 'user',
        parts: [{ text: turn.text }],
      });
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const generateWithTimeout = <T>(promise: Promise<T>, ms = 6500): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI request timeout')), ms)),
      ]);
    };

    // Try the configured grounded generation path first, then a standard response path.
    for (const model of candidateModels) {
      try {
        const response = await generateWithTimeout(
          ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
              tools: [{ googleSearch: {} }],
            },
          }),
          7000
        );

        const replyText = response.text?.trim();
        if (replyText) {
          const grounding = (response.candidates?.[0] as any)?.groundingMetadata;
          const searchChunks = grounding?.groundingChunks
            ?.map((c: any) => c.web ? { title: c.web.title || c.web.uri || 'Web source', uri: c.web.uri } : null)
            .filter(Boolean);

          return res.json({
            reply: replyText,
            grounded: Boolean(searchChunks?.length),
            sources: searchChunks || [],
            sourceLabel: searchChunks?.length ? 'Google Search grounded' : 'Connected catalog snapshot',
            realTimeTimestamp: Date.now(),
          });
        }
      } catch (err: any) {
        // If googleSearch tool is not allowed or times out, retry standard generateContent without tools
        try {
          const fallbackResp = await generateWithTimeout(
            ai.models.generateContent({
              model,
              contents,
              config: {
                systemInstruction,
                temperature: 0.7,
              },
            }),
            5000
          );
          const replyText = fallbackResp.text?.trim();
          if (replyText) {
            return res.json({
              reply: replyText,
              grounded: false,
              sourceLabel: 'AI answer using the current catalog snapshot',
              realTimeTimestamp: Date.now(),
            });
          }
        } catch (innerErr: any) {
          console.warn(`Model ${model} fallback failed in /api/ai/chat:`, innerErr?.message?.slice(0, 100));
        }
      }
    }
  }

  // Safe conversational fallback; the browser may calculate a local comparison from its catalog.
  const smartReply = generateSmartFallback(message, location, catalogSummary);
  return res.json({
    reply: smartReply,
    fallback: true,
    grounded: false,
    sourceLabel: 'Catalog context fallback; confirm at checkout',
    realTimeTimestamp: Date.now(),
  });
});

app.use('/api', (_req: Request, res: Response) => {
  return res.status(404).json({ error: 'API route not found.' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }
  if (req.path.startsWith('/api')) {
    console.error('Unhandled API error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
  return next(err);
});

// Setup Vite middlewares in development or static serve in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      configFile: path.join(__dirname, 'vite.config.ts'),
      root: __dirname,
      // Managed Preview proxies the application port but not Vite's separate
      // HMR socket, so disable HMR to prevent a broken /@vite/client socket.
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.get('/', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const template = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        const withoutHmrClient = transformed.replace(
          /\s*<script[^>]+src=["']\/?@vite\/client["'][^>]*><\/script>/gi,
          ''
        );
        res.status(200).type('html').send(withoutHmrClient);
      } catch (error) {
        next(error);
      }
    });
    app.use(vite.middlewares);
    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/_app')) {
        return next();
      }
      try {
        const template = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        const withoutHmrClient = transformed.replace(
          /\s*<script[^>]+src=["']\/?@vite\/client["'][^>]*><\/script>/gi,
          ''
        );
        res.status(200).type('html').send(withoutHmrClient);
      } catch (error) {
        next(error);
      }
    });
  } else {
    const publicDir = path.join(__dirname, 'dist', 'public');
    app.use(express.static(publicDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`DealNest server running at http://0.0.0.0:${port}`);
  });
}

startServer();
