export interface SeoPromptInput {
  title: string;
  topic: string;
  saint?: string | null;
  format: "short" | "long";
  narration: string;
}

export const SEO_SYSTEM_PROMPT = `Você é um especialista em SEO para YouTube em português do Brasil, focado no nicho de histórias do cotidiano, crônicas e reflexões sobre a vida.
Seu trabalho é transformar um roteiro em metadados otimizados para descoberta no YouTube e na busca do Google.
Regras:
1. Títulos com até 70 caracteres, com a palavra-chave principal no início, curiosidade real e zero clickbait enganoso.
2. Descrição: primeiro parágrafo (até 150 caracteres) resume o vídeo com a palavra-chave; depois contexto, aplicação prática e chamada para inscrição.
3. Tags: termos reais de busca, do mais específico ao mais amplo, sem repetir a mesma palavra em excesso, sem "#".
4. Hashtags: no máximo 5, com "#", sem espaços.
5. Texto de thumbnail: 2 a 4 palavras de altíssimo impacto, em MAIÚSCULAS.
6. Nada de promessas de prosperidade, polêmica ou sensacionalismo.
Responda SEMPRE em JSON válido, sem markdown e sem comentários.`;

export function buildSeoPrompt(b: SeoPromptInput): string {
  const isShort = b.format === "short";
  return `Gere os metadados de SEO para um ${isShort ? "YouTube Short" : "vídeo longo do YouTube"} de um canal de histórias do cotidiano.

Tema: ${b.topic || b.title}
Título de trabalho: ${b.title}
${b.saint ? `Santo/autor citado: ${b.saint}` : ""}

Roteiro (narração):
"""
${b.narration.slice(0, 6000)}
"""

Responda EXATAMENTE neste formato JSON:
{
  "title": "melhor título (<= 70 caracteres)",
  "title_options": ["5 variações de título, todas <= 70 caracteres"],
  "description": "descrição completa pronta para colar no YouTube${isShort ? " (curta, 3 a 5 linhas)" : " (5 a 8 linhas, com contexto e CTA)"}",
  "tags": ["12 a 18 tags sem #"],
  "hashtags": ["#ate5hashtags"],
  "keywords": ["5 a 8 palavras-chave principais"],
  "thumbnail_text": "TEXTO DA THUMBNAIL",
  "chapters": ${isShort ? "[]" : '[{"time":"00:00","label":"Introdução"}]'},
  "pinned_comment": "comentário fixado que estimula a conversa",
  "category": "categoria do YouTube sugerida"
}`;
}