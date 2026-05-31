import crypto from "node:crypto";

const COST = {
  N: 16384,
  r: 8,
  p: 1,
  keylen: 64
};

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .scryptSync(password, salt, COST.keylen, { N: COST.N, r: COST.r, p: COST.p })
    .toString("hex");
  return `scrypt$${COST.N}$${COST.r}$${COST.p}$${salt}$${derived}`;
}

export function verifyPassword(password, encodedHash) {
  const [algo, n, r, p, salt, digest] = String(encodedHash || "").split("$");
  if (algo !== "scrypt" || !n || !r || !p || !salt || !digest) return false;

  const computed = crypto
    .scryptSync(password, salt, Number(digest.length / 2), {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    })
    .toString("hex");

  return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(computed, "hex"));
}
