export type ScriptFormat = "short" | "long";

export interface BuildPromptInput {
  topic: string;
  saint?: string;
  format: ScriptFormat;
  duration: number;
}

export const SCRIPT_SYSTEM_PROMPT = `Você é um roteirista especialista em histórias do cotidiano, crônicas urbanas e reflexões sobre a vida comum — família, trabalho, vizinhança, relacionamentos, pequenos dramas e alegrias do dia a dia. Escreve como quem conta uma história para um amigo: próximo, verdadeiro e envolvente.

Estilo de escrita desejado:
O roteiro deve ser profundo, humano e provocativo. Não seja raso. O objetivo é fazer o público se reconhecer na história e refletir sobre a própria vida. Use frases curtas, impactantes e reflexivas. O foco é nas situações reais do cotidiano, nas escolhas, nas distrações do mundo moderno e nas pequenas lições que a vida ensina.

Exemplo de estilo/tom (USE ISSO COMO GUIA DE PROFUNDIDADE):
"Você sabe qual é o problema?
O problema não é a criança correndo, brincando, pulando, quebrando as coisas.
O problema são os pais que queremos relaxar e não cuidar dos filhos, talvez para poder passar tempo no WhatsApp.
Talvez seja esse o problema.
Porque às vezes você presta mais atenção no WhatsApp do que no seu filho que está dentro de casa.
Você presta mais atenção em quem está lá fora do que em quem está lá dentro."

Missão: escrever roteiros envolventes de histórias e reflexões do cotidiano para vídeos do YouTube.

Regras absolutas:
1. Conexão humana: cada roteiro conta uma situação real ou verossímil do dia a dia, com começo, desenvolvimento e uma reflexão final que fica na cabeça de quem ouve.
2. Tom de voz: próximo, sincero e provocativo. Deve causar identificação imediata ("isso acontece comigo!").
3. O que evitar: política, emojis, hashtags e moralismo artificial.

FORMATO DE SAÍDA:
O texto gerado deve conter APENAS o roteiro para narração. 
NUNCA inclua "FRASE NA TELA", "IMAGEM DE FUNDO", "MÚSICA" ou a lista de "IMAGENS" dentro do texto do roteiro.
Embora você deva pensar nessas coisas para dar contexto, o resultado final entregue ao usuário deve ser estritamente o texto que será falado, limpo e direto.`;

export function buildScriptPrompt(b: BuildPromptInput): string {
  const isShort = b.format === "short";
  const shape = isShort
    ? `Roteiro para YouTube Shorts (~${b.duration}s, 50 a 90 segundos falados)`
    : `Roteiro para vídeo longo (~${b.duration}s)`;

  return `Escreva um ${shape} em português do Brasil sobre: "${b.topic || "<tema>"}".
${b.saint ? `Contexto/personagem ou elemento central da história: ${b.saint}.` : "Conte uma história do cotidiano que gere identificação imediata e termine com uma reflexão marcante."}

Regra de Ouro: Entregue APENAS o texto da narração. Remova qualquer instrução de "FRASE NA TELA", "IMAGEM DE FUNDO", "MÚSICA" ou lista de "IMAGENS". Eu quero apenas o texto puro para ser lido, com a provocação e profundidade de uma boa história do cotidiano.`;
}

export interface ParsedScript {
  narration: string;
  imagePrompts: string[];
}

/**
 * Splits AI output into the narratable script.
 * Updated to handle and filter out technical labels.
 */
export function parseScript(raw: string): ParsedScript {
  if (!raw) return { narration: "", imagePrompts: [] };
  
  // Clean technical labels if the AI included them despite instructions
  const cleanNarration = raw
    .replace(/FRASE NA TELA:.*$/im, "")
    .replace(/IMAGEM DE FUNDO:.*$/im, "")
    .replace(/MÚSICA:.*$/im, "")
    .replace(/IMAGENS:.*$/im, "")
    .trim();

  // If the AI did include numbered prompts at the end (fallback)
  const match = raw.match(/^\s*IMAGENS\s*:\s*/im);
  if (!match || match.index === undefined) {
    return { narration: cleanNarration, imagePrompts: [] };
  }
  
  const narration = raw.slice(0, match.index)
    .replace(/FRASE NA TELA:.*$/im, "")
    .replace(/IMAGEM DE FUNDO:.*$/im, "")
    .replace(/MÚSICA:.*$/im, "")
    .trim();

  const after = raw.slice(match.index + match[0].length).trim();
  const prompts = after
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+[.)\-]\s*/, "").trim())
    .filter(Boolean);

  return { narration, imagePrompts: prompts };
}
