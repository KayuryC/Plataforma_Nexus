import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const filePath = path.join(dataDir, "nexus.json");
fs.mkdirSync(dataDir, { recursive: true });

const EMPTY_DB = {
  counters: { user: 0 },
  users: [],
  refreshTokens: [],
  producerProfiles: []
};

function cloneEmptyDb() {
  return structuredClone(EMPTY_DB);
}

function initialsFromName(name) {
  const letters = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return letters || "PR";
}

function normalizeDb(snapshot) {
  return {
    counters: { user: Number(snapshot?.counters?.user || 0) },
    users: Array.isArray(snapshot?.users) ? snapshot.users : [],
    refreshTokens: Array.isArray(snapshot?.refreshTokens) ? snapshot.refreshTokens : [],
    producerProfiles: Array.isArray(snapshot?.producerProfiles) ? snapshot.producerProfiles : []
  };
}

function createProducerProfile(user) {
  const now = new Date().toISOString();
  const familyId = user.familyId || `prod-${user.id}`;
  return {
    id: familyId,
    userId: user.id,
    email: user.email,
    sigla: initialsFromName(user.name),
    nome: user.name,
    responsavel: user.name,
    filhos: 0,
    ha: 0,
    culturas: "Cadastro iniciado",
    solo: "Não informado",
    agua: "Não informado",
    semana: 1,
    status: "regular",
    engajamento: 10,
    localizacao: "Cadastro realizado na feira",
    desafio: "Completar dados técnicos da propriedade",
    treinamento: "Pendente",
    membros: 1,
    cadastroStatus: "novo",
    lastRecordAt: null,
    lastRecordNote: null,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeProducerProfile(profile, user = {}) {
  return {
    id: profile.id || user.familyId || `prod-${user.id}`,
    userId: profile.userId || user.id,
    email: profile.email || user.email || "",
    sigla: profile.sigla || initialsFromName(profile.nome || user.name),
    nome: profile.nome || user.name || "Produtor",
    responsavel: profile.responsavel || profile.nome || user.name || "Produtor",
    filhos: Number(profile.filhos || 0),
    ha: Number(profile.ha || 0),
    culturas: profile.culturas || "Cadastro iniciado",
    solo: profile.solo || "Não informado",
    agua: profile.agua || "Não informado",
    semana: Number(profile.semana || 1),
    status: profile.status || "regular",
    engajamento: Number(profile.engajamento || 0),
    localizacao: profile.localizacao || "Cadastro realizado na feira",
    desafio: profile.desafio || "Completar dados técnicos da propriedade",
    treinamento: profile.treinamento || "Pendente",
    membros: Number(profile.membros || 1),
    cadastroStatus: profile.cadastroStatus || "novo",
    lastRecordAt: profile.lastRecordAt || null,
    lastRecordNote: profile.lastRecordNote || null,
    createdAt: profile.createdAt || user.createdAt || new Date().toISOString(),
    updatedAt: profile.updatedAt || profile.createdAt || user.createdAt || new Date().toISOString()
  };
}

function ensureProducerProfileInDb(db, user) {
  let profile = db.producerProfiles.find(
    (item) => item.userId === user.id || item.email === user.email || item.id === user.familyId
  );

  if (!profile) {
    profile = createProducerProfile(user);
    db.producerProfiles.push(profile);
    return profile;
  }

  profile.userId = profile.userId || user.id;
  profile.email = profile.email || user.email;
  profile.id = profile.id || user.familyId || `prod-${user.id}`;
  profile.nome = profile.nome || user.name;
  profile.responsavel = profile.responsavel || user.name;
  profile.sigla = profile.sigla || initialsFromName(user.name);
  return profile;
}

function loadDb() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(EMPTY_DB, null, 2));
    return cloneEmptyDb();
  }
  return normalizeDb(JSON.parse(fs.readFileSync(filePath, "utf-8")));
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
  if (role === "produtor") {
    ensureProducerProfileInDb(db, created);
  }
  saveDb(db);
  return normalizeUser(created);
}

export function upsertUserByEmail({ email, name, role, passwordHash, familyId = null }) {
  const db = loadDb();
  const normalizedEmail = email.toLowerCase();
  const idx = db.users.findIndex((u) => u.email === normalizedEmail);

  if (idx >= 0) {
    db.users[idx] = {
      ...db.users[idx],
      name,
      role,
      familyId,
      password_hash: passwordHash,
      isActive: true
    };
    if (role === "produtor") {
      ensureProducerProfileInDb(db, db.users[idx]);
    }
    saveDb(db);
    return normalizeUser(db.users[idx]);
  }

  db.counters.user += 1;
  const created = {
    id: db.counters.user,
    email: normalizedEmail,
    name,
    role,
    password_hash: passwordHash,
    familyId,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(created);
  if (role === "produtor") {
    ensureProducerProfileInDb(db, created);
  }
  saveDb(db);
  return normalizeUser(created);
}

export function listProducerProfiles() {
  const db = loadDb();
  const producers = db.users.filter((user) => user.role === "produtor" && user.isActive !== false);
  const profiles = producers.map((user) => {
    const profile = ensureProducerProfileInDb(db, user);
    return normalizeProducerProfile(profile, user);
  });
  saveDb(db);
  return profiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function findProducerProfileByUserId(userId) {
  const db = loadDb();
  const user = db.users.find((item) => item.id === userId && item.role === "produtor");
  if (!user || user.isActive === false) return null;
  const profile = ensureProducerProfileInDb(db, user);
  saveDb(db);
  return normalizeProducerProfile(profile, user);
}

export function updateProducerProfileByUserId(userId, patch = {}) {
  const db = loadDb();
  const user = db.users.find((item) => item.id === userId && item.role === "produtor");
  if (!user || user.isActive === false) return null;

  const profile = ensureProducerProfileInDb(db, user);
  const allowed = [
    "responsavel",
    "filhos",
    "ha",
    "culturas",
    "solo",
    "agua",
    "semana",
    "status",
    "engajamento",
    "localizacao",
    "desafio",
    "treinamento",
    "membros",
    "cadastroStatus",
    "lastRecordAt",
    "lastRecordNote"
  ];

  for (const key of allowed) {
    if (Object.hasOwn(patch, key) && patch[key] !== undefined) {
      profile[key] = patch[key];
    }
  }

  profile.nome = user.name;
  profile.email = user.email;
  profile.sigla = initialsFromName(user.name);
  profile.updatedAt = new Date().toISOString();
  saveDb(db);
  return normalizeProducerProfile(profile, user);
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
