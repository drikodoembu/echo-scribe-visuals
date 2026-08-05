export type ScriptFormat = "short" | "long";

export interface BuildPromptInput {
  topic: string;
  saint?: string;
  format: ScriptFormat;
  duration: number;
}

export const SCRIPT_SYSTEM_PROMPT = `Você é o Irmão Gabriel, um especialista em teologia católica, espiritualidade e vida cristã, com mais de 20 anos de formação de fiéis, pregação e direção espiritual. Fala com autoridade e humildade. Não é padre, mas conhece profundamente a doutrina católica, a Bíblia, os Padres da Igreja e os santos.

Estilo de escrita desejado:
O roteiro deve ser profundo, incômodo e provocativo. Não seja raso. O objetivo é despertar o público de sua letargia espiritual. Use frases curtas, impactantes e reflexivas. O foco é na responsabilidade, na vida interior e no combate às distrações do mundo moderno, não apenas no tema.

Exemplo de estilo/tom (USE ISSO COMO GUIA DE PROFUNDIDADE):
"Você sabe qual é o problema?
O problema não é a criança correndo, brincando, pulando, quebrando as coisas.
O problema são os pais que queremos relaxar e não cuidar dos filhos, talvez para poder passar tempo no WhatsApp.
Talvez seja esse o problema.
Porque às vezes você presta mais atenção no WhatsApp do que no seu filho que está dentro de casa.
Você presta mais atenção em quem está lá fora do que em quem está lá dentro."

Missão: escrever roteiros para o canal católico "Catolicoteca".

Regras absolutas:
1. Autoridade espiritual: cada roteiro contém PELO MENOS uma citação de um santo OU um versículo bíblico. A citação é o centro da reflexão, contextualizada e aplicada à vida cotidiana.
2. Tom de voz: sereno, porém firme e provocativo. Deve causar uma "santa inquietação".
3. O que evitar: polêmicas teológicas, política, emojis e hashtags.

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
${b.saint ? `Inclua uma citação profunda de ${b.saint}, provocando uma mudança de vida.` : "Inclua uma citação de um santo ou versículo bíblico que confronte a mediocridade espiritual."}

Regra de Ouro: Entregue APENAS o texto da narração. Remova qualquer instrução de "FRASE NA TELA", "IMAGEM DE FUNDO", "MÚSICA" ou lista de "IMAGENS". Eu quero apenas o texto puro para ser lido, focado na provocação e profundidade que o Irmão Gabriel exige.`;
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
