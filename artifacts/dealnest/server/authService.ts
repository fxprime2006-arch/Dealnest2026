import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SecretCodeRecord {
  id: string;
  // Present only in the transient response immediately after generation.
  // Persisted records contain only the salted hash.
  code?: string;
  codeHash: string;
  salt: string;
  status: 'active' | 'used' | 'disabled' | 'revoked';
  createdAt: number;
  usedAt: number | null;
  usedBy: string | null;
  usedIp?: string | null;
  usedUserAgent?: string | null;
  note: string;
}

export interface AccessActivityRecord {
  id: string;
  codeId: string;
  code: string;
  userName: string;
  ip: string;
  userAgent: string;
  usedAt: number;
}

export interface SiteConfig {
  accessGateEnabled: boolean;
  defaultCustomerView: 'home' | 'account' | 'search';
  defaultLocation: string;
  disclaimerVersion: number;
  disclaimerText: string;
  disclaimerUpdatedAt: number;
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  ip: string;
  action: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SessionRecord {
  token: string;
  type: 'admin' | 'user';
  createdAt: number;
  expiresAt: number;
  codeId?: string;
  userLabel?: string;
  acceptedDisclaimerVersion?: number;
}

export interface AuthDatabase {
  admin: {
    hash: string;
    salt: string;
    needsChange: boolean;
    lastChanged: number;
  };
  secretCodes: SecretCodeRecord[];
  sessions: SessionRecord[];
  activity: AccessActivityRecord[];
  auditLogs: AuditLogRecord[];
  config: SiteConfig;
}

const DB_FILE = path.join(__dirname, '..', 'data', 'auth_db.json');

function maskSecretCode(code: string | undefined): string {
  if (!code) return 'Stored securely';
  const normalized = code.trim();
  const parts = normalized.split('-');
  if (parts.length >= 3) return `${parts[0]}-••••-••••`;
  return '••••••••';
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Helper to hash with salt using SHA-256
export function hashWithSalt(input: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + ':' + input).digest('hex');
}

// Helper to generate random codes
export function generateCodeString(prefix = 'NEST'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // exclude ambiguous 0, O, 1, I
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(crypto.randomInt(chars.length));
    part2 += chars.charAt(crypto.randomInt(chars.length));
  }
  return `${prefix}-${part1}-${part2}`;
}

// In-memory rate limiter
interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number;
}
const rateLimits = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry) {
    return { allowed: true };
  }

  if (entry.lockedUntil > now) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  // Reset if window expired (5 minutes)
  if (now - entry.firstAttempt > 5 * 60 * 1000) {
    rateLimits.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(key: string): { locked: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = rateLimits.get(key) || { attempts: 0, firstAttempt: now, lockedUntil: 0 };

  entry.attempts += 1;

  // If >= 5 failed attempts, lock out
  if (entry.attempts >= 5) {
    const lockSeconds = Math.min(60 * Math.pow(2, entry.attempts - 5), 15 * 60); // 60s, 120s, up to 15m
    entry.lockedUntil = now + lockSeconds * 1000;
    rateLimits.set(key, entry);
    return { locked: true, retryAfterSeconds: lockSeconds };
  }

  rateLimits.set(key, entry);
  return { locked: false };
}

export function resetRateLimit(key: string): void {
  rateLimits.delete(key);
}

// Auth Database Manager
export class AuthStore {
  private db: AuthDatabase;

  constructor() {
    this.ensureDataDir();
    this.db = this.loadOrCreate();
    // Rewrite legacy records without plaintext secret codes on startup.
    this.save();
  }

  private ensureDataDir() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadOrCreate(): AuthDatabase {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<AuthDatabase>;
        const secretCodes = Array.isArray(parsed.secretCodes)
          ? parsed.secretCodes.map(({ code: _legacyCode, ...record }) => record)
          : [];
        const activity = Array.isArray(parsed.activity)
          ? parsed.activity.map(entry => ({ ...entry, code: maskSecretCode(entry.code) }))
          : [];
        return {
          ...(parsed as AuthDatabase),
          secretCodes,
          activity,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          config: {
            accessGateEnabled: parsed.config?.accessGateEnabled ?? true,
            defaultCustomerView: parsed.config?.defaultCustomerView ?? 'home',
            defaultLocation: parsed.config?.defaultLocation ?? 'Hyderabad',
            disclaimerVersion: parsed.config?.disclaimerVersion ?? 1,
            disclaimerText: parsed.config?.disclaimerText ?? 'This platform is free to use. Information is provided for general resource and comparison purposes, may change without notice, and should be independently verified before you act. No content on this platform is a guarantee, endorsement, or substitute for your own judgment.',
            disclaimerUpdatedAt: parsed.config?.disclaimerUpdatedAt ?? Date.now(),
          },
        };
      } catch (err) {
        console.error('Failed to parse auth_db.json, reinitializing...', err);
      }
    }

    // Initial setup: initial admin access code is 12345
    const initialSalt = crypto.randomBytes(16).toString('hex');
    const initialHash = hashWithSalt('12345', initialSalt);

    const initialDb: AuthDatabase = {
      admin: {
        hash: initialHash,
        salt: initialSalt,
        needsChange: true,
        lastChanged: Date.now(),
      },
      secretCodes: [],
      sessions: [],
      activity: [],
      auditLogs: [],
      config: {
        accessGateEnabled: true,
        defaultCustomerView: 'home',
        defaultLocation: 'Hyderabad',
        disclaimerVersion: 1,
        disclaimerText: 'This platform is free to use. Information is provided for general resource and comparison purposes, may change without notice, and should be independently verified before you act. No content on this platform is a guarantee, endorsement, or substitute for your own judgment.',
        disclaimerUpdatedAt: Date.now(),
      },
    };

    this.save(initialDb);
    return initialDb;
  }

  private save(data = this.db) {
    try {
      this.ensureDataDir();
      const tempFile = `${DB_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Failed to save auth_db.json', err);
    }
  }

  // --- Admin Methods ---

  public verifyAdminCode(code: string): { valid: boolean; needsChange: boolean } {
    const inputHash = hashWithSalt(code.trim(), this.db.admin.salt);
    const valid = safeEqual(inputHash, this.db.admin.hash);
    return {
      valid,
      needsChange: this.db.admin.needsChange,
    };
  }

  public changeAdminCode(currentCode: string, newCode: string): { success: boolean; error?: string } {
    const { valid } = this.verifyAdminCode(currentCode);
    if (!valid) {
      return { success: false, error: 'Current admin access code is incorrect.' };
    }

    if (!newCode || newCode.trim().length < 5) {
      return { success: false, error: 'New admin code must be at least 5 characters long.' };
    }

    if (newCode.trim() === '12345') {
      return { success: false, error: 'Please choose a different custom secure code.' };
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashWithSalt(newCode.trim(), newSalt);

    this.db.admin.hash = newHash;
    this.db.admin.salt = newSalt;
    this.db.admin.needsChange = false;
    this.db.admin.lastChanged = Date.now();

    this.save();
    return { success: true };
  }

  public createAdminSession(): string {
    const token = 'adm_' + crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    this.db.sessions.push({
      token,
      type: 'admin',
      createdAt: now,
      expiresAt,
    });

    this.cleanExpiredSessions();
    this.save();
    return token;
  }

  public validateAdminSession(token: string): boolean {
    if (!token) return false;
    const now = Date.now();
    const session = this.db.sessions.find(s => s.token === token && s.type === 'admin' && s.expiresAt > now);
    return !!session;
  }

  public invalidateSession(token: string): void {
    this.db.sessions = this.db.sessions.filter(s => s.token !== token);
    this.save();
  }

  // --- Secret Codes Methods ---

  public getAllCodes(): SecretCodeRecord[] {
    return [...this.db.secretCodes]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ code: _plaintextCode, ...record }) => record);
  }

  public getConfig(): SiteConfig {
    return { ...this.db.config };
  }

  public updateConfig(next: Partial<SiteConfig>): SiteConfig {
    if (typeof next.accessGateEnabled === 'boolean') {
      this.db.config.accessGateEnabled = next.accessGateEnabled;
    }
    if (next.defaultCustomerView && ['home', 'account', 'search'].includes(next.defaultCustomerView)) {
      this.db.config.defaultCustomerView = next.defaultCustomerView;
    }
    if (typeof next.defaultLocation === 'string' && next.defaultLocation.trim()) {
      this.db.config.defaultLocation = next.defaultLocation.trim().slice(0, 40);
    }
    if (typeof next.disclaimerText === 'string' && next.disclaimerText.trim()) {
      const normalized = next.disclaimerText.trim().slice(0, 12000);
      if (normalized !== this.db.config.disclaimerText) {
        this.db.config.disclaimerText = normalized;
        this.db.config.disclaimerVersion += 1;
        this.db.config.disclaimerUpdatedAt = Date.now();
      }
    }
    this.save();
    return this.getConfig();
  }

  public getActivity(): AccessActivityRecord[] {
    return [...this.db.activity].sort((a, b) => b.usedAt - a.usedAt);
  }

  public recordAudit(input: Omit<AuditLogRecord, 'id' | 'timestamp'> & { timestamp?: number }): AuditLogRecord {
    const record: AuditLogRecord = {
      id: 'audit_' + crypto.randomBytes(10).toString('hex'),
      userId: input.userId || 'anonymous',
      ip: input.ip || 'unknown',
      action: input.action.slice(0, 80),
      description: input.description.slice(0, 500),
      timestamp: input.timestamp || Date.now(),
      metadata: input.metadata,
    };
    this.db.auditLogs.push(record);
    if (this.db.auditLogs.length > 5000) this.db.auditLogs = this.db.auditLogs.slice(-5000);
    this.save();
    return record;
  }

  public getAuditLogs(limit = 500): AuditLogRecord[] {
    return [...this.db.auditLogs].sort((a, b) => b.timestamp - a.timestamp).slice(0, Math.max(1, Math.min(limit, 2000)));
  }

  public getUserSession(token: string): SessionRecord | null {
    const now = Date.now();
    return this.db.sessions.find(s => s.token === token && s.type === 'user' && s.expiresAt > now) || null;
  }

  public hasAcceptedDisclaimer(token: string): boolean {
    const session = this.getUserSession(token);
    return !!session && session.acceptedDisclaimerVersion === this.db.config.disclaimerVersion;
  }

  public acceptDisclaimer(token: string): boolean {
    const session = this.getUserSession(token);
    if (!session) return false;
    session.acceptedDisclaimerVersion = this.db.config.disclaimerVersion;
    this.save();
    return true;
  }

  public generateSecretCodes(count = 1, note = 'Generated by Admin', prefix = 'NEST'): SecretCodeRecord[] {
    const safeCount = Math.max(1, Math.min(count, 50));
    const created: Array<SecretCodeRecord & { code: string }> = [];

    for (let i = 0; i < safeCount; i++) {
      let code = generateCodeString(prefix);
      let normalized = code.toUpperCase().replace(/\s+/g, '');
      // Ensure uniqueness
      while (this.db.secretCodes.some(c => hashWithSalt(normalized, c.salt) === c.codeHash)) {
        code = generateCodeString(prefix);
        normalized = code.toUpperCase().replace(/\s+/g, '');
      }

      const salt = crypto.randomBytes(12).toString('hex');
      const codeHash = hashWithSalt(normalized, salt);

      const record: SecretCodeRecord = {
        id: 'sc_' + crypto.randomBytes(8).toString('hex'),
        codeHash,
        salt,
        status: 'active',
        createdAt: Date.now(),
        usedAt: null,
        usedBy: null,
        note: note.trim() || 'Access Code',
      };

      this.db.secretCodes.push(record);
      // Return the raw code only in this one response; it is never persisted.
      created.push({ ...record, code });
    }

    this.save();
    return created;
  }

  public updateCodeStatus(id: string, status: 'active' | 'disabled' | 'revoked', note?: string): SecretCodeRecord | null {
    const code = this.db.secretCodes.find(c => c.id === id);
    if (!code) return null;

    code.status = status;
    if (note !== undefined) {
      code.note = note.trim();
    }

    this.save();
    const { code: _plaintextCode, ...safeRecord } = code;
    return safeRecord;
  }

  public deleteCode(id: string): boolean {
    const initialLen = this.db.secretCodes.length;
    this.db.secretCodes = this.db.secretCodes.filter(c => c.id !== id);
    const deleted = this.db.secretCodes.length < initialLen;
    if (deleted) {
      this.save();
    }
    return deleted;
  }

  // --- User Enrollment Methods ---

  public verifyAndEnrollCode(
    rawCode: string,
    userName = 'Enrolled Member',
    metadata: { ip?: string; userAgent?: string } = {}
  ): {
    success: boolean;
    token?: string;
    error?: string;
    codeRecord?: SecretCodeRecord;
  } {
    const normalized = rawCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!normalized) {
      return { success: false, error: 'Please enter a secret access code.' };
    }

    // Find matching code by comparing hash
    const match = this.db.secretCodes.find(c => {
      const testHash = hashWithSalt(normalized, c.salt);
      return safeEqual(testHash, c.codeHash);
    });

    if (!match) {
      return { success: false, error: 'Invalid secret access code. Please check your code or contact the administrator.' };
    }

    if (match.status === 'disabled') {
      return { success: false, error: 'This access code is currently disabled by the administrator.' };
    }

    if (match.status === 'revoked') {
      return { success: false, error: 'This access code has been permanently revoked by the administrator.' };
    }

    if (match.status === 'used') {
      return { success: false, error: 'This access code has already been redeemed and cannot be reused.' };
    }

    // Mark as used
    match.status = 'used';
    match.usedAt = Date.now();
    match.usedBy = userName.trim().slice(0, 120) || 'Enrolled Member';
    match.usedIp = metadata.ip || null;
    match.usedUserAgent = metadata.userAgent || null;

    this.db.activity.push({
      id: 'act_' + crypto.randomBytes(8).toString('hex'),
      codeId: match.id,
      code: maskSecretCode(normalized),
      userName: match.usedBy,
      ip: metadata.ip || 'unknown',
      userAgent: metadata.userAgent || 'unknown',
      usedAt: match.usedAt,
    });

    // Issue user session token (7 days)
    const token = 'usr_' + crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

    this.db.sessions.push({
      token,
      type: 'user',
      createdAt: now,
      expiresAt,
      codeId: match.id,
      userLabel: match.usedBy,
      acceptedDisclaimerVersion: 0,
    });

    this.cleanExpiredSessions();
    this.save();

    return {
      success: true,
      token,
      codeRecord: match,
    };
  }

  public validateUserSession(token: string): { valid: boolean; user?: { name: string; codeId?: string; userId?: string }; disclaimer?: { required: boolean; version: number; text: string; updatedAt: number } } {
    if (!token) return { valid: false };
    const session = this.getUserSession(token);
    if (!session) return { valid: false };

    return {
      valid: true,
      user: {
        name: session.userLabel || 'Enrolled Member',
        codeId: session.codeId,
        userId: session.codeId ? `user_${session.codeId}` : 'user_unknown',
      },
      disclaimer: {
        required: session.acceptedDisclaimerVersion !== this.db.config.disclaimerVersion,
        version: this.db.config.disclaimerVersion,
        text: this.db.config.disclaimerText,
        updatedAt: this.db.config.disclaimerUpdatedAt,
      },
    };
  }

  private cleanExpiredSessions() {
    const now = Date.now();
    this.db.sessions = this.db.sessions.filter(s => s.expiresAt > now);
  }
}

export const authStore = new AuthStore();
