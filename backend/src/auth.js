import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config, isProd } from "./config.js";

export function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      familyId: user.familyId || null,
      email: user.email,
      name: user.name
    },
    config.jwtAccessSecret,
    { expiresIn: config.accessTokenTtl, algorithm: "HS256" }
  );
}

export function generateRefreshToken(user) {
  const jti = crypto.randomUUID();
  const raw = crypto.randomBytes(48).toString("base64url");
  const token = jwt.sign({ sub: String(user.id), jti, typ: "refresh" }, config.jwtRefreshSecret, {
    expiresIn: config.refreshTokenTtl,
    algorithm: "HS256"
  });
  return { jti, token, tokenHash: hashToken(`${raw}.${token}`), raw };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret, { algorithms: ["HS256"] });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret, { algorithms: ["HS256"] });
}

function parseJwtExpiryToIso(token) {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded !== "object" || !decoded.exp) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return new Date(decoded.exp * 1000).toISOString();
}

export function buildRefreshSession(user) {
  const created = generateRefreshToken(user);
  return {
    jti: created.jti,
    refreshCookieValue: `${created.raw}.${created.token}`,
    refreshCookieHash: created.tokenHash,
    expiresAt: parseJwtExpiryToIso(created.token)
  };
}

export function generateCsrfToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function setAuthCookies(res, accessToken, refreshValue, csrfToken) {
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/"
  };

  res.cookie("nexus_at", accessToken, {
    ...base,
    maxAge: 15 * 60 * 1000
  });

  res.cookie("nexus_rt", refreshValue, {
    ...base,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.cookie("nexus_csrf", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export function clearAuthCookies(res) {
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/"
  };
  res.clearCookie("nexus_at", base);
  res.clearCookie("nexus_rt", base);
  res.clearCookie("nexus_csrf", {
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    path: "/"
  });
}
