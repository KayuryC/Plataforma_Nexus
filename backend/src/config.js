import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3333),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5500",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_me",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "7d"
};

export const isProd = config.nodeEnv === "production";
