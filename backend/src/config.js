import dotenv from "dotenv";

dotenv.config();

function requireStrongSecret(name, value) {
  const raw = String(value || "");
  const tooShort = raw.length < 32;
  const looksDefault = raw.includes("troque_") || raw.includes("change_me");
  if (!raw || tooShort || looksDefault) {
    throw new Error(
      `Variável ${name} inválida. Defina um segredo forte no .env com pelo menos 32 caracteres.`
    );
  }
  return raw;
}

export const config = {
  port: Number(process.env.PORT || 3333),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5500",
  jwtAccessSecret: requireStrongSecret("JWT_ACCESS_SECRET", process.env.JWT_ACCESS_SECRET),
  jwtRefreshSecret: requireStrongSecret("JWT_REFRESH_SECRET", process.env.JWT_REFRESH_SECRET),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "7d"
};

export const isProd = config.nodeEnv === "production";
