export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function sanitizeText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeContext(payload = {}) {
  return {
    role: sanitizeText(payload.role, 'produtor'),
    nome: sanitizeText(payload.nome, 'Produtor'),
    cultura: sanitizeText(payload.cultura, 'cultivo não informado'),
    solo: sanitizeText(payload.solo, 'solo não informado'),
    clima: sanitizeText(payload.clima, 'clima não informado'),
    desafio: sanitizeText(payload.desafio, 'desafio não informado'),
    semana: Number(payload.semana || 0) || 0
  };
}

function fallbackRecommendation(ctx) {
  const culturaPrincipal = ctx.cultura.split(',')[0]?.trim().toLowerCase() || 'cultivo';
  const semanaTexto = ctx.semana > 0 ? `na semana ${ctx.semana}` : 'nesta semana';
  return `Recomendação inicial para ${ctx.nome}: foque ${semanaTexto} no monitoramento diário de ${culturaPrincipal}, com verificação de umidade do solo no início da manhã e no fim da tarde. Registre sinais de estresse nas folhas e, se houver piora, priorize irrigação leve e acompanhamento técnico no próximo ciclo.`;
}

function extractRecommendation(data) {
  if(typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const blocks = Array.isArray(data?.output) ? data.output : [];
  const textParts = [];
  for(const block of blocks) {
    const content = Array.isArray(block?.content) ? block.content : [];
    for(const item of content) {
      if(typeof item?.text === 'string' && item.text.trim()) {
        textParts.push(item.text.trim());
      }
    }
  }
  return textParts.join('\n\n').trim();
}

function buildPrompt(ctx) {
  return [
    'Você é um agrônomo assistente da plataforma Nexus.',
    'Gere uma recomendação objetiva em português brasileiro com no máximo 130 palavras.',
    'Use linguagem simples para produtor rural e inclua: ação imediata, monitoramento da semana e alerta de risco.',
    '',
    `Perfil: ${ctx.role}`,
    `Nome: ${ctx.nome}`,
    `Culturas: ${ctx.cultura}`,
    `Solo: ${ctx.solo}`,
    `Clima: ${ctx.clima}`,
    `Desafio atual: ${ctx.desafio}`,
    `Semana: ${ctx.semana || 'não informada'}`
  ].join('\n');
}

async function callOpenAI(ctx) {
  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey) {
    return {
      source: 'fallback',
      recommendation: fallbackRecommendation(ctx),
      warning: 'OPENAI_API_KEY não configurada no ambiente.'
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: buildPrompt(ctx),
      max_output_tokens: 280
    })
  });

  const data = await response.json().catch(() => ({}));
  if(!response.ok) {
    return {
      source: 'fallback',
      recommendation: fallbackRecommendation(ctx),
      warning: data?.error?.message || 'Falha ao consultar provedor de IA.'
    };
  }

  const recommendation = extractRecommendation(data);
  if(!recommendation) {
    return {
      source: 'fallback',
      recommendation: fallbackRecommendation(ctx),
      warning: 'Resposta vazia do provedor de IA.'
    };
  }

  return { source: 'openai', model, recommendation };
}

export default async function handler(request) {
  if(request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if(request.method !== 'POST') {
    return json({ error: 'Método não permitido. Use POST.' }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_err) {
    return json({ error: 'JSON inválido no corpo da requisição.' }, 400);
  }

  const ctx = normalizeContext(payload);

  try {
    const result = await callOpenAI(ctx);
    return json({
      source: result.source,
      model: result.model || null,
      recommendation: result.recommendation,
      warning: result.warning || null,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    return json({
      source: 'fallback',
      model: null,
      recommendation: fallbackRecommendation(ctx),
      warning: err?.message || 'Erro inesperado na IA Edge.',
      generatedAt: new Date().toISOString()
    });
  }
}
