import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import {
  buildRefreshSession,
  clearAuthCookies,
  generateAccessToken,
  generateCsrfToken,
  hashToken,
  setAuthCookies,
  verifyAccessToken,
  verifyRefreshToken
} from "./auth.js";
import { config } from "./config.js";
import {
  findRefreshTokenById,
  findUserByEmail,
  findUserById,
  insertUser,
  insertRefreshToken,
  revokeRefreshToken
} from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";

const app = express();
const DUMMY_PASSWORD_HASH = hashPassword("nexus_dummy_password_to_reduce_timing_leak");

app.use(helmet());
app.use(
  cors({
    origin: config.frontendOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "300kb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." }
});

const registerLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de cadastro. Aguarde alguns minutos." }
});

function cleanUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    familyId: user.familyId || null
  };
}

function authFromAccessCookie(req) {
  const token = req.cookies?.nexus_at;
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

function requireCsrf(req, res, next) {
  const csrfCookie = req.cookies?.nexus_csrf;
  const csrfHeader = req.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: "Requisição bloqueada por proteção CSRF." });
  }
  return next();
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function gerarFamilyId(email) {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return base || `prod-${Date.now().toString(36)}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "nexus-auth-api" });
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const { email, password, perfil } = req.body ?? {};

  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  const requestedProfile = typeof perfil === "string" ? perfil : null;
  const user = findUserByEmail(email.trim().toLowerCase());
  const storedHash = user?.password_hash || DUMMY_PASSWORD_HASH;
  const validPassword = verifyPassword(password, storedHash);
  const profileOk =
    !requestedProfile ||
    (user && (requestedProfile === user.role || (requestedProfile === "admin" && user.role === "coordenador")));

  if (!user || !user.isActive || !validPassword || !profileOk) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const accessToken = generateAccessToken(user);
  const refresh = buildRefreshSession(user);
  const csrfToken = generateCsrfToken();
  insertRefreshToken({
    id: refresh.jti,
    userId: user.id,
    tokenHash: refresh.refreshCookieHash,
    expiresAt: refresh.expiresAt
  });

  setAuthCookies(res, accessToken, refresh.refreshCookieValue, csrfToken);
  return res.json({ user: cleanUser(user) });
});

app.post("/api/auth/register-producer", registerLimiter, async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, email e senha são obrigatórios." });
  }

  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Dados inválidos para cadastro." });
  }

  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (trimmedName.length < 3 || trimmedName.length > 120 || !emailValido(normalizedEmail)) {
    return res.status(400).json({ error: "Nome ou email inválido." });
  }
  if (password.length < 10 || password.length > 120) {
    return res.status(400).json({ error: "A senha deve ter entre 10 e 120 caracteres." });
  }

  const existingUser = findUserByEmail(normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ error: "Este email já está cadastrado." });
  }

  const createdUser = insertUser({
    email: normalizedEmail,
    name: trimmedName,
    role: "produtor",
    passwordHash: hashPassword(password),
    familyId: gerarFamilyId(normalizedEmail)
  });

  const accessToken = generateAccessToken(createdUser);
  const refresh = buildRefreshSession(createdUser);
  const csrfToken = generateCsrfToken();
  insertRefreshToken({
    id: refresh.jti,
    userId: createdUser.id,
    tokenHash: refresh.refreshCookieHash,
    expiresAt: refresh.expiresAt
  });

  setAuthCookies(res, accessToken, refresh.refreshCookieValue, csrfToken);
  return res.status(201).json({ user: cleanUser(createdUser) });
});

app.post("/api/auth/refresh", requireCsrf, (req, res) => {
  const cookieValue = req.cookies?.nexus_rt;
  if (!cookieValue || typeof cookieValue !== "string" || !cookieValue.includes(".")) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Sessão expirada." });
  }

  const firstDot = cookieValue.indexOf(".");
  const raw = cookieValue.slice(0, firstDot);
  const token = cookieValue.slice(firstDot + 1);

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Sessão expirada." });
  }

  const stored = findRefreshTokenById(decoded.jti);
  if (!stored || stored.revokedAt || new Date(stored.expiresAt).getTime() < Date.now()) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Sessão expirada." });
  }

  const computedHash = hashToken(`${raw}.${token}`);
  if (computedHash !== stored.tokenHash) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Sessão inválida." });
  }

  const user = findUserById(Number(decoded.sub));
  if (!user || !user.isActive) {
    clearAuthCookies(res);
    return res.status(401).json({ error: "Usuário inválido." });
  }

  revokeRefreshToken(stored.id);
  const accessToken = generateAccessToken(user);
  const refresh = buildRefreshSession(user);
  const csrfToken = generateCsrfToken();
  insertRefreshToken({
    id: refresh.jti,
    userId: user.id,
    tokenHash: refresh.refreshCookieHash,
    expiresAt: refresh.expiresAt
  });

  setAuthCookies(res, accessToken, refresh.refreshCookieValue, csrfToken);
  return res.json({ user: cleanUser(user) });
});

app.get("/api/auth/me", (req, res) => {
  const payload = authFromAccessCookie(req);
  if (!payload?.sub) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const user = findUserById(Number(payload.sub));
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Usuário inválido." });
  }
  return res.json({ user: cleanUser(user) });
});

app.post("/api/auth/logout", requireCsrf, (req, res) => {
  const cookieValue = req.cookies?.nexus_rt;
  if (cookieValue && typeof cookieValue === "string") {
    const firstDot = cookieValue.indexOf(".");
    const token = firstDot > 0 ? cookieValue.slice(firstDot + 1) : "";
    try {
      const decoded = verifyRefreshToken(token);
      if (decoded?.jti) revokeRefreshToken(decoded.jti);
    } catch {
      // Ignora token inválido no logout.
    }
  }
  clearAuthCookies(res);
  res.status(204).end();
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Nexus Auth API ativa em http://localhost:${config.port}`);
});
