import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const filePath = path.join(dataDir, "nexus.json");
fs.mkdirSync(dataDir, { recursive: true });

const EMPTY_DB = {
  counters: { user: 0 },
  users: [],
  refreshTokens: []
};

function loadDb() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(EMPTY_DB, null, 2));
    return structuredClone(EMPTY_DB);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveDb(snapshot) {
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
}

function normalizeUser(user) {
  return {
    ...user,
    familyId: user.familyId || null,
    isActive: user.isActive !== false
  };
}

export function findUserByEmail(email) {
  const db = loadDb();
  const user = db.users.find((u) => u.email === email.toLowerCase());
  return user ? normalizeUser(user) : null;
}

export function findUserById(id) {
  const db = loadDb();
  const user = db.users.find((u) => u.id === id);
  return user ? normalizeUser(user) : null;
}

export function findUserByExactEmail(email) {
  const db = loadDb();
  const user = db.users.find((u) => u.email === email.toLowerCase());
  return user ? normalizeUser(user) : null;
}

export function insertUser({ email, name, role, passwordHash, familyId = null }) {
  const db = loadDb();
  db.counters.user += 1;
  const created = {
    id: db.counters.user,
    email: email.toLowerCase(),
    name,
    role,
    password_hash: passwordHash,
    familyId,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(created);
  saveDb(db);
  return normalizeUser(created);
}

export function insertRefreshToken({ id, userId, tokenHash, expiresAt }) {
  const db = loadDb();
  db.refreshTokens.push({
    id,
    userId,
    tokenHash,
    expiresAt,
    revokedAt: null,
    createdAt: new Date().toISOString()
  });
  saveDb(db);
}

export function findRefreshTokenById(id) {
  const db = loadDb();
  return db.refreshTokens.find((t) => t.id === id) || null;
}

export function revokeRefreshToken(id) {
  const db = loadDb();
  const idx = db.refreshTokens.findIndex((t) => t.id === id);
  if (idx < 0) return;
  db.refreshTokens[idx].revokedAt = new Date().toISOString();
  saveDb(db);
}
