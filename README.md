# Plataforma_Nexus

Plataforma de gestão de famílias e produção agrícola da comunidade de Jutaiteua.

## Estrutura atual

- `index.html`: entrada da Vercel; redireciona para o app.
- `plataformanexus.html`: frontend do app (admin e produtor).
- `backend/`: API de autenticação real (Express + JSON local + JWT em cookie HttpOnly).
- `api/ia.js`: função Edge para recomendações com IA (pronta para Vercel).
- `vercel.json`: configuração de URLs limpas para a Vercel.

## Como rodar para demo/feira

O frontend agora usa o backend por padrão (`nexus-auth-mode="api"`):

- Administrador: apenas login com as contas Donato ou Marcelo
- Produtor: cria conta pela tela inicial
- O administrador vê os produtores cadastrados no painel, na lista de famílias e nos cadernos

1. Instale dependências do backend:
```bash
cd backend
npm install
```

2. Configure ambiente:
```bash
cp .env.example .env
```

3. Edite `.env` e defina:
- `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` com segredos fortes (>=32 chars)
- mantenha `SEED_DEFAULT_PASSWORD` com a senha combinada para a feira

4. Gere o administrador/coordenador de desenvolvimento:
```bash
npm run seed
```

5. Suba a API:
```bash
npm run dev
```

API: `http://localhost:3333`

6. Rode o frontend (ex: Live Server):
- `http://localhost:5500/`
- `http://localhost:5500/plataformanexus.html`

Na tela:
- Entre como administrador/coordenador usando as credenciais informadas aos representantes
- Em outra aba/dispositivo, selecione Produtor, faça cadastro e complete os dados da propriedade
- O painel do administrador atualiza periodicamente e mostra novos produtores

Se o backend não estiver rodando, o frontend ativa automaticamente um modo demo local para a interface não travar durante a apresentação. Nesse modo os dados ficam apenas no navegador atual; para ver cadastros entre dispositivos/abas reais, mantenha a API em `http://localhost:3333`.

## Backend e dados

O backend deixou de ser opcional para o fluxo multiusuário da feira. Ele persiste usuários, perfis de produtores e registros de envio de caderno em `backend/data/nexus.json`.

Endpoints novos do MVP:
- `GET /api/admin/producers`: administrador lista produtores cadastrados
- `GET /api/producers/me`: produtor carrega seu perfil
- `PATCH /api/producers/me`: produtor atualiza dados da propriedade
- `POST /api/producers/me/caderno`: produtor registra envio de caderno/foto

## Usuários de desenvolvimento

- `donato@nexus.local` (admin)
- `marcelo@nexus.local` (coordenador)

## Regras de acesso (MVP atual)

- Administrador: apenas login pela tela; cadastro desativado.
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

## IA Edge (novo)

A área "Recomendações da IA" do produtor agora consegue chamar uma função Edge:

- endpoint padrão em produção: `/api/ia`
- endpoint padrão local: `http://localhost:3000/api/ia`

### Variáveis de ambiente (Vercel)

- `OPENAI_API_KEY` (obrigatória para IA real)
- `OPENAI_MODEL` (opcional, padrão: `gpt-4o-mini`)

Se `OPENAI_API_KEY` não estiver definida, a função retorna uma recomendação de contingência (fallback) para não travar o app.

### Teste local da Edge Function

No diretório raiz do projeto:

```bash
vercel dev
```

Abra:

- `http://localhost:3000`
