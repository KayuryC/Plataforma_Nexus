import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import {
  buildRefreshSession,
  clearAuthCookies,
  generateAccessToken,
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
  insertRefreshToken,
  revokeRefreshToken
} from "./db.js";
import { verifyPassword } from "./password.js";

const app = express();

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "nexus-auth-api" });
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const { email, password, perfil } = req.body ?? {};

  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  if (perfil && perfil !== user.role && !(perfil === "admin" && user.role === "coordenador")) {
    return res.status(403).json({ error: "Perfil selecionado não corresponde ao usuário." });
  }

  const validPassword = verifyPassword(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const accessToken = generateAccessToken(user);
  const refresh = buildRefreshSession(user);
  insertRefreshToken({
    id: refresh.jti,
    userId: user.id,
    tokenHash: refresh.refreshCookieHash,
    expiresAt: refresh.expiresAt
  });

  setAuthCookies(res, accessToken, refresh.refreshCookieValue);
  return res.json({ user: cleanUser(user) });
});

app.post("/api/auth/refresh", (req, res) => {
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
  insertRefreshToken({
    id: refresh.jti,
    userId: user.id,
    tokenHash: refresh.refreshCookieHash,
    expiresAt: refresh.expiresAt
  });

  setAuthCookies(res, accessToken, refresh.refreshCookieValue);
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

app.post("/api/auth/logout", (req, res) => {
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
