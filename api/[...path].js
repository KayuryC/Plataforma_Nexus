import crypto from 'node:crypto';

const ACCESS_COOKIE = 'nexus_at';
const REFRESH_COOKIE = 'nexus_rt';
const CSRF_COOKIE = 'nexus_csrf';
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ADMIN_SEEDS = [
  { email: 'donato@nexus.local', name: 'Donato Silva', role: 'admin' },
  { email: 'marcelo@nexus.local', name: 'Marcelo Heinen', role: 'coordenador' }
];

const PASSWORD_COST = { N: 16384, r: 8, p: 1, keylen: 64 };

function getStore() {
  if (!globalThis.__NEXUS_VERCEL_STORE__) {
    globalThis.__NEXUS_VERCEL_STORE__ = {
      counters: { user: 0 },
      users: [],
      producerProfiles: [],
      seedPasswordHash: null
    };
  }
  return globalThis.__NEXUS_VERCEL_STORE__;
}

function getAdminPassword() {
  return process.env.SEED_DEFAULT_PASSWORD || process.env.NEXUS_ADMIN_PASSWORD || '';
}

function getAuthSecret() {
  return process.env.NEXUS_AUTH_SECRET || process.env.JWT_ACCESS_SECRET || 'nexus-vercel-demo-secret-change-me';
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signToken(payload, ttlMs) {
  const body = {
    ...payload,
    exp: Date.now() + ttlMs,
    iat: Date.now()
  };
  const encoded = base64UrlEncode(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token, expectedType = 'access') {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;

  const expected = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  const signatureBuffer = Buffer.from(signature.padEnd(expected.length));
  const expectedBuffer = Buffer.from(expected.padEnd(signature.length));
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    if (payload.typ !== expectedType || Number(payload.exp || 0) < Date.now()) return null;
    return payload;
  } catch (_err) {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto
    .scryptSync(password, salt, PASSWORD_COST.keylen, PASSWORD_COST)
    .toString('hex');
  return `scrypt$${PASSWORD_COST.N}$${PASSWORD_COST.r}$${PASSWORD_COST.p}$${salt}$${derived}`;
}

function verifyPassword(password, encodedHash) {
  const [algo, n, r, p, salt, digest] = String(encodedHash || '').split('$');
  if (algo !== 'scrypt' || !n || !r || !p || !salt || !digest) return false;

  const computed = crypto
    .scryptSync(password, salt, Number(digest.length / 2), {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    })
    .toString('hex');

  return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(computed, 'hex'));
}

function initialsFromName(name) {
  return (
    String(name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'PR'
  );
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function gerarFamilyId(email) {
  const base = String(email || '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return base || `prod-${Date.now().toString(36)}`;
}

function cleanText(value, fallback = '', max = 160) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : fallback;
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function createProducerProfile(user) {
  const now = new Date().toISOString();
  return {
    id: user.familyId || `prod-${user.id}`,
    userId: user.id,
    email: user.email,
    sigla: initialsFromName(user.name),
    nome: user.name,
    responsavel: user.name,
    filhos: 0,
    ha: 0,
    culturas: 'Cadastro iniciado',
    solo: 'Não informado',
    agua: 'Não informado',
    semana: 1,
    status: 'regular',
    engajamento: 10,
    localizacao: 'Cadastro realizado na feira',
    desafio: 'Completar dados técnicos da propriedade',
    treinamento: 'Pendente',
    membros: 1,
    cadastroStatus: 'novo',
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
    email: profile.email || user.email || '',
    sigla: profile.sigla || initialsFromName(profile.nome || user.name),
    nome: profile.nome || user.name || 'Produtor',
    responsavel: profile.responsavel || profile.nome || user.name || 'Produtor',
    filhos: Number(profile.filhos || 0),
    ha: Number(profile.ha || 0),
    culturas: profile.culturas || 'Cadastro iniciado',
    solo: profile.solo || 'Não informado',
    agua: profile.agua || 'Não informado',
    semana: Number(profile.semana || 1),
    status: profile.status || 'regular',
    engajamento: Number(profile.engajamento || 0),
    localizacao: profile.localizacao || 'Cadastro realizado na feira',
    desafio: profile.desafio || 'Completar dados técnicos da propriedade',
    treinamento: profile.treinamento || 'Pendente',
    membros: Number(profile.membros || 1),
    cadastroStatus: profile.cadastroStatus || 'novo',
    lastRecordAt: profile.lastRecordAt || null,
    lastRecordNote: profile.lastRecordNote || null,
    createdAt: profile.createdAt || user.createdAt || new Date().toISOString(),
    updatedAt: profile.updatedAt || profile.createdAt || user.createdAt || new Date().toISOString()
  };
}

function ensureProducerProfile(store, user) {
  let profile = store.producerProfiles.find(
    (item) => item.userId === user.id || item.email === user.email || item.id === user.familyId
  );

  if (!profile) {
    profile = createProducerProfile(user);
    store.producerProfiles.push(profile);
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

function normalizeUser(user) {
  return {
    ...user,
    familyId: user.familyId || null,
    isActive: user.isActive !== false
  };
}

function cleanUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    familyId: user.familyId || null
  };
}

function ensureSeedUsers() {
  const store = getStore();
  const password = getAdminPassword();
  if (!password || password.length < 12) return;

  const nextSeedHash = crypto.createHash('sha256').update(password).digest('hex');
  const shouldRefreshSeed = store.seedPasswordHash !== nextSeedHash;

  for (const seed of ADMIN_SEEDS) {
    const normalizedEmail = seed.email.toLowerCase();
    let user = store.users.find((item) => item.email === normalizedEmail);
    if (!user) {
      store.counters.user += 1;
      user = {
        id: store.counters.user,
        email: normalizedEmail,
        name: seed.name,
        role: seed.role,
        password_hash: hashPassword(password),
        familyId: null,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      store.users.push(user);
    } else if (shouldRefreshSeed) {
      user.name = seed.name;
      user.role = seed.role;
      user.familyId = null;
      user.password_hash = hashPassword(password);
      user.isActive = true;
    }
  }

  store.seedPasswordHash = nextSeedHash;
}

function findUserByEmail(email) {
  ensureSeedUsers();
  const store = getStore();
  const user = store.users.find((item) => item.email === String(email || '').toLowerCase());
  return user ? normalizeUser(user) : null;
}

function findUserById(id) {
  ensureSeedUsers();
  const store = getStore();
  const user = store.users.find((item) => item.id === Number(id));
  return user ? normalizeUser(user) : null;
}

function insertProducer({ email, name, password }) {
  const store = getStore();
  store.counters.user += 1;
  const user = {
    id: store.counters.user,
    email: email.toLowerCase(),
    name,
    role: 'produtor',
    password_hash: hashPassword(password),
    familyId: gerarFamilyId(email),
    isActive: true,
    createdAt: new Date().toISOString()
  };
  store.users.push(user);
  ensureProducerProfile(store, user);
  return normalizeUser(user);
}

function listProducerProfiles() {
  ensureSeedUsers();
  const store = getStore();
  return store.users
    .filter((user) => user.role === 'produtor' && user.isActive !== false)
    .map((user) => normalizeProducerProfile(ensureProducerProfile(store, user), user))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function findProducerProfileByUserId(userId) {
  const store = getStore();
  const user = store.users.find((item) => item.id === Number(userId) && item.role === 'produtor');
  if (!user || user.isActive === false) return null;
  return normalizeProducerProfile(ensureProducerProfile(store, user), user);
}

function updateProducerProfileByUserId(userId, patch = {}) {
  const store = getStore();
  const user = store.users.find((item) => item.id === Number(userId) && item.role === 'produtor');
  if (!user || user.isActive === false) return null;

  const profile = ensureProducerProfile(store, user);
  const allowed = [
    'responsavel',
    'filhos',
    'ha',
    'culturas',
    'solo',
    'agua',
    'semana',
    'status',
    'engajamento',
    'localizacao',
    'desafio',
    'treinamento',
    'membros',
    'cadastroStatus',
    'lastRecordAt',
    'lastRecordNote'
  ];

  for (const key of allowed) {
    if (Object.hasOwn(patch, key) && patch[key] !== undefined) profile[key] = patch[key];
  }

  profile.nome = user.name;
  profile.email = user.email;
  profile.sigla = initialsFromName(user.name);
  profile.updatedAt = new Date().toISOString();
  return normalizeProducerProfile(profile, user);
}

function cookieOptions(maxAgeSeconds, httpOnly = true, secure = true) {
  return [
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    httpOnly ? 'HttpOnly' : ''
  ]
    .filter(Boolean)
    .join('; ');
}

function serializeCookie(name, value, options) {
  return `${name}=${encodeURIComponent(value)}; ${options}`;
}

function expiredCookie(name, httpOnly = true, secure = true) {
  return serializeCookie(name, '', [
    'Max-Age=0',
    'Path=/',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    httpOnly ? 'HttpOnly' : ''
  ].filter(Boolean).join('; '));
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(
    raw
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const idx = item.indexOf('=');
        if (idx < 0) return [item, ''];
        return [item.slice(0, idx), decodeURIComponent(item.slice(idx + 1))];
      })
  );
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-csrf-token');
}

function isSecureRequest(req) {
  return process.env.VERCEL === '1' || req.headers['x-forwarded-proto'] === 'https';
}

function sendJson(req, res, status, body, cookies = []) {
  setCors(req, res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end(JSON.stringify(body));
}

function sendNoContent(req, res, cookies = []) {
  setCors(req, res);
  res.statusCode = 204;
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end();
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function issueSessionCookies(req, user) {
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  const accessToken = signToken(
    {
      typ: 'access',
      sub: String(user.id),
      role: user.role,
      familyId: user.familyId || null,
      email: user.email,
      name: user.name
    },
    ACCESS_TTL_MS
  );
  const refreshToken = signToken({ typ: 'refresh', sub: String(user.id) }, REFRESH_TTL_MS);
  const secure = isSecureRequest(req);

  return [
    serializeCookie(ACCESS_COOKIE, accessToken, cookieOptions(15 * 60, true, secure)),
    serializeCookie(REFRESH_COOKIE, refreshToken, cookieOptions(7 * 24 * 60 * 60, true, secure)),
    serializeCookie(CSRF_COOKIE, csrfToken, cookieOptions(7 * 24 * 60 * 60, false, secure))
  ];
}

function clearSessionCookies(req) {
  const secure = isSecureRequest(req);
  return [
    expiredCookie(ACCESS_COOKIE, true, secure),
    expiredCookie(REFRESH_COOKIE, true, secure),
    expiredCookie(CSRF_COOKIE, false, secure)
  ];
}

function authPayload(req) {
  const cookies = parseCookies(req);
  return verifyToken(cookies[ACCESS_COOKIE], 'access');
}

function requireCsrf(req) {
  const cookies = parseCookies(req);
  return !!cookies[CSRF_COOKIE] && cookies[CSRF_COOKIE] === req.headers['x-csrf-token'];
}

function profilePatchFromBody(body = {}) {
  return {
    responsavel: cleanText(body.responsavel, undefined),
    filhos: clampNumber(body.filhos, undefined, 0, 20),
    ha: clampNumber(body.ha, undefined, 0, 500),
    culturas: cleanText(body.culturas, undefined, 180),
    solo: cleanText(body.solo, undefined, 120),
    agua: cleanText(body.agua, undefined, 120),
    localizacao: cleanText(body.localizacao, undefined, 180),
    desafio: cleanText(body.desafio, undefined, 240),
    membros: clampNumber(body.membros, undefined, 1, 50),
    cadastroStatus: 'ativo'
  };
}

function authenticatedUser(req, res) {
  const payload = authPayload(req);
  if (!payload?.sub) {
    sendJson(req, res, 401, { error: 'Não autenticado.' });
    return null;
  }

  const user = findUserById(Number(payload.sub));
  if (!user || !user.isActive) {
    sendJson(req, res, 401, { error: 'Usuário inválido.' });
    return null;
  }
  return user;
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const requestedProfile = typeof body.perfil === 'string' ? body.perfil : null;

  if (!email || !password) {
    return sendJson(req, res, 400, { error: 'Email e senha são obrigatórios.' });
  }

  if (!getAdminPassword()) {
    return sendJson(req, res, 503, {
      error: 'Senha administrativa não configurada no ambiente da Vercel.'
    });
  }

  const user = findUserByEmail(email);
  const validPassword = user ? verifyPassword(password, user.password_hash) : false;
  const profileOk =
    !requestedProfile ||
    (user && (requestedProfile === user.role || (requestedProfile === 'admin' && user.role === 'coordenador')));

  if (!user || !user.isActive || !validPassword || !profileOk) {
    return sendJson(req, res, 401, { error: 'Credenciais inválidas.' });
  }

  return sendJson(req, res, 200, { user: cleanUser(user) }, issueSessionCookies(req, user));
}

async function handleRegisterProducer(req, res) {
  const body = await readBody(req);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name || !email || !password) {
    return sendJson(req, res, 400, { error: 'Nome, email e senha são obrigatórios.' });
  }
  if (name.length < 3 || name.length > 120 || !emailValido(email)) {
    return sendJson(req, res, 400, { error: 'Nome ou email inválido.' });
  }
  if (password.length < 10 || password.length > 120) {
    return sendJson(req, res, 400, { error: 'A senha deve ter entre 10 e 120 caracteres.' });
  }
  if (findUserByEmail(email)) {
    return sendJson(req, res, 409, { error: 'Este email já está cadastrado.' });
  }

  const user = insertProducer({ email, name, password });
  return sendJson(
    req,
    res,
    201,
    {
      user: cleanUser(user),
      familia: findProducerProfileByUserId(user.id)
    },
    issueSessionCookies(req, user)
  );
}

function handleRefresh(req, res) {
  if (!requireCsrf(req)) {
    return sendJson(req, res, 403, { error: 'Requisição bloqueada por proteção CSRF.' });
  }

  const cookies = parseCookies(req);
  const payload = verifyToken(cookies[REFRESH_COOKIE], 'refresh');
  if (!payload?.sub) {
    return sendJson(req, res, 401, { error: 'Sessão expirada.' }, clearSessionCookies(req));
  }

  const user = findUserById(Number(payload.sub));
  if (!user || !user.isActive) {
    return sendJson(req, res, 401, { error: 'Usuário inválido.' }, clearSessionCookies(req));
  }

  return sendJson(req, res, 200, { user: cleanUser(user) }, issueSessionCookies(req, user));
}

function handleMe(req, res) {
  const user = authenticatedUser(req, res);
  if (!user) return;
  return sendJson(req, res, 200, { user: cleanUser(user) });
}

function handleLogout(req, res) {
  return sendNoContent(req, res, clearSessionCookies(req));
}

function handleAdminProducers(req, res) {
  const user = authenticatedUser(req, res);
  if (!user) return;
  if (user.role !== 'admin' && user.role !== 'coordenador') {
    return sendJson(req, res, 403, { error: 'Acesso restrito ao administrador.' });
  }

  return sendJson(req, res, 200, {
    familias: listProducerProfiles(),
    generatedAt: new Date().toISOString()
  });
}

function handleProducerMe(req, res) {
  const user = authenticatedUser(req, res);
  if (!user) return;
  if (user.role !== 'produtor') {
    return sendJson(req, res, 403, { error: 'Este perfil não é de produtor.' });
  }
  return sendJson(req, res, 200, { familia: findProducerProfileByUserId(user.id) });
}

async function handlePatchProducerMe(req, res) {
  if (!requireCsrf(req)) {
    return sendJson(req, res, 403, { error: 'Requisição bloqueada por proteção CSRF.' });
  }

  const user = authenticatedUser(req, res);
  if (!user) return;
  if (user.role !== 'produtor') {
    return sendJson(req, res, 403, { error: 'Este perfil não é de produtor.' });
  }

  const body = await readBody(req);
  const profile = updateProducerProfileByUserId(user.id, profilePatchFromBody(body));
  return sendJson(req, res, 200, { familia: profile });
}

async function handleProducerCaderno(req, res) {
  if (!requireCsrf(req)) {
    return sendJson(req, res, 403, { error: 'Requisição bloqueada por proteção CSRF.' });
  }

  const user = authenticatedUser(req, res);
  if (!user) return;
  if (user.role !== 'produtor') {
    return sendJson(req, res, 403, { error: 'Este perfil não é de produtor.' });
  }

  const current = findProducerProfileByUserId(user.id);
  if (!current) return sendJson(req, res, 404, { error: 'Perfil de produtor não encontrado.' });

  const body = await readBody(req);
  const now = new Date().toISOString();
  const note = cleanText(body.note, 'Foto do caderno enviada pelo produtor.', 220);
  const nextEngagement = Math.min(100, Math.max(Number(current.engajamento || 0), 35) + 8);
  const profile = updateProducerProfileByUserId(user.id, {
    semana: clampNumber(body.semana, current.semana, 1, 52),
    status: 'ativo',
    engajamento: nextEngagement,
    cadastroStatus: current.cadastroStatus === 'novo' ? 'ativo' : current.cadastroStatus,
    lastRecordAt: now,
    lastRecordNote: note
  });

  return sendJson(req, res, 201, { familia: profile });
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url, `https://${req.headers.host || 'nexus.local'}`);
  const path = url.pathname.replace(/^\/api/, '') || '/';

  try {
    if (req.method === 'GET' && path === '/health') {
      return sendJson(req, res, 200, { ok: true, service: 'nexus-vercel-api' });
    }
    if (req.method === 'POST' && path === '/auth/login') return await handleLogin(req, res);
    if (req.method === 'POST' && path === '/auth/register-producer') {
      return await handleRegisterProducer(req, res);
    }
    if (req.method === 'POST' && path === '/auth/refresh') return handleRefresh(req, res);
    if (req.method === 'GET' && path === '/auth/me') return handleMe(req, res);
    if (req.method === 'POST' && path === '/auth/logout') return handleLogout(req, res);
    if (req.method === 'GET' && path === '/admin/producers') return handleAdminProducers(req, res);
    if (req.method === 'GET' && path === '/producers/me') return handleProducerMe(req, res);
    if (req.method === 'PATCH' && path === '/producers/me') return await handlePatchProducerMe(req, res);
    if (req.method === 'POST' && path === '/producers/me/caderno') {
      return await handleProducerCaderno(req, res);
    }

    return sendJson(req, res, 404, { error: 'Rota não encontrada.' });
  } catch (err) {
    return sendJson(req, res, 500, {
      error: err?.message || 'Não foi possível concluir a requisição.'
    });
  }
}
