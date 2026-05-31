# Plataforma_Nexus

Plataforma de gestão de famílias e produção agrícola da comunidade de Jutaiteua.

## Estrutura atual

- `plataformanexus.html`: frontend protótipo (admin e produtor).
- `backend/`: API de autenticação real (Express + JSON local + JWT em cookie HttpOnly).

## Como rodar (modo simples)

Atualmente o login/cadastro está em modo simples no frontend (`localStorage`), para acelerar desenvolvimento:

- Administrador: pode cadastrar e fazer login
- Produtor: pode cadastrar e fazer login
- Os dados ficam salvos no navegador local (não é multiusuário real)

Para abrir:

1. Rode o frontend (ex: Live Server):
- `http://localhost:5500/plataformanexus.html`

## Backend (opcional por enquanto)

Se quiser testar o backend também, mantenha estes passos:

1. Instale dependências:
```bash
cd backend
npm install
```

2. Configure ambiente:
```bash
cp .env.example .env
```
Importante:
- defina `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` com segredos fortes (>=32 chars)
- defina `SEED_DEFAULT_PASSWORD` com senha forte (>=12 chars)

3. Gere usuários de desenvolvimento:
```bash
export SEED_DEFAULT_PASSWORD='SUA_SENHA_FORTE_AQUI'
npm run seed
```

4. Suba a API:
```bash
npm run dev
```

API: `http://localhost:3333`

5. Rode o frontend:
- `http://localhost:5500/plataformanexus.html`

## Usuários de desenvolvimento

- `donato@nexus.local` / senha definida em `SEED_DEFAULT_PASSWORD` (admin)
- `marcelo@nexus.local` / senha definida em `SEED_DEFAULT_PASSWORD` (coordenador)

## Regras de acesso (MVP atual)

- Administrador: cadastro e login pela tela.
- Produtor: cadastro e login pela tela.

## Deploy na Vercel

- O frontend detecta automaticamente:
  - local: `http://localhost:3333/api`
  - produção: `${window.location.origin}/api`
- Se a API estiver em outro domínio, ajuste no HTML:
  - tag `<meta name="nexus-api-base" content="https://SUA-API/api"/>`
- Recomendado para monorepo:
  - projeto frontend com Root Directory `.`
  - projeto backend com Root Directory `backend`
