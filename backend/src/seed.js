import dotenv from "dotenv";
import { upsertUserByEmail } from "./db.js";
import { hashPassword } from "./password.js";

dotenv.config();

const seeds = [
  {
    email: "donato@nexus.local",
    name: "Donato Silva",
    role: "admin"
  },
  {
    email: "marcelo@nexus.local",
    name: "Marcelo Heinen",
    role: "coordenador"
  }
];

async function run() {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
  if (!defaultPassword || defaultPassword.length < 12 || defaultPassword.includes("troque_")) {
    throw new Error(
      "Defina SEED_DEFAULT_PASSWORD no ambiente com no mínimo 12 caracteres antes de rodar o seed."
    );
  }

  for (const user of seeds) {
    const passwordHash = hashPassword(defaultPassword);
    upsertUserByEmail({
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash,
      familyId: user.familyId || null
    });
  }
  // eslint-disable-next-line no-console
  console.log("Seed concluído. Usuários de desenvolvimento criados.");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
