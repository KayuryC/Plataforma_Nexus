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

3. Gere usuários de desenvolvimento:
```bash
npm run seed
```

4. Suba a API:
```bash
npm run dev
```

API: `http://localhost:3333`

## Usuários de desenvolvimento

- `donato@nexus.local` / `Nexus@2026` (admin)
- `marcelo@nexus.local` / `Nexus@2026` (coordenador)
- `raimundo@nexus.local` / `Nexus@2026` (produtor)
- `pompeu@nexus.local` / `Nexus@2026` (produtor)
