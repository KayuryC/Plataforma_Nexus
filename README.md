# Plataforma_Nexus

Plataforma de gestão de famílias e produção agrícola da comunidade de Jutaiteua.

## Estrutura atual

- `plataformanexus.html`: frontend protótipo (admin e produtor).
- `backend/`: API de autenticação real (Express + JSON local + JWT em cookie HttpOnly).

## Como rodar a autenticação local

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

## Usuários de desenvolvimento

- `donato@nexus.local` / senha definida em `SEED_DEFAULT_PASSWORD` (admin)
- `marcelo@nexus.local` / senha definida em `SEED_DEFAULT_PASSWORD` (coordenador)
- `raimundo@nexus.local` / senha definida em `SEED_DEFAULT_PASSWORD` (produtor)
- `pompeu@nexus.local` / senha definida em `SEED_DEFAULT_PASSWORD` (produtor)
