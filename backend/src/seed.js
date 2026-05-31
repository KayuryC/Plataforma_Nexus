import { findUserByExactEmail, insertUser } from "./db.js";
import { hashPassword } from "./password.js";

const seeds = [
  {
    email: "donato@nexus.local",
    name: "Donato Silva",
    role: "admin",
    password: "Nexus@2026"
  },
  {
    email: "marcelo@nexus.local",
    name: "Marcelo Heinen",
    role: "coordenador",
    password: "Nexus@2026"
  },
  {
    email: "raimundo@nexus.local",
    name: "Raimundo Nonato Gonçalves",
    role: "produtor",
    familyId: "raimundo",
    password: "Nexus@2026"
  },
  {
    email: "pompeu@nexus.local",
    name: "José Maria Pompeu",
    role: "produtor",
    familyId: "pompeu",
    password: "Nexus@2026"
  }
];

async function run() {
  for (const user of seeds) {
    const alreadyExists = findUserByExactEmail(user.email);
    if (alreadyExists) continue;

    const passwordHash = hashPassword(user.password);
    insertUser({
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
