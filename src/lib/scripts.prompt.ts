export type ScriptFormat = "short" | "long";

export interface BuildPromptInput {
  topic: string;
  saint?: string;
  format: ScriptFormat;
  duration: number;
}

export const SCRIPT_SYSTEM_PROMPT =
  "Você é um roteirista católico ortodoxo, claro e conciso.";

export function buildScriptPrompt(b: BuildPromptInput): string {
  const shape =
    b.format === "short"
      ? `Roteiro para YouTube Shorts (~${b.duration}s, ~150 palavras)`
      : `Roteiro para vídeo longo (~${b.duration}s)`;
  const imgCount = b.format === "short" ? "4 a 6" : "6 a 10";
  return `Você é um roteirista católico fiel ao Magistério da Igreja.
Escreva um ${shape} em português do Brasil sobre: "${b.topic || "<tema>"}".
${b.saint ? `Inclua uma citação atribuída a ${b.saint}.` : "Inclua uma citação de um santo ou doutor da Igreja."}

Estrutura obrigatória (marque cada seção com título em MAIÚSCULAS seguido de dois-pontos):
GANCHO: 1-2 frases de impacto.
CITAÇÃO: frase do santo + nome.
APLICAÇÃO: aplicação prática à vida cristã hoje.
CHAMADA: convite para seguir o canal e viver o Evangelho.
IMAGENS: ${imgCount} prompts numerados (1., 2., ...), em INGLÊS, prontos para geradores como Midjourney/SDXL/Flux. Cada prompt em UMA linha, descrevendo cena sacra católica coerente com o roteiro (composição, sujeito, iluminação, estilo — ex.: "cinematic renaissance oil painting, ..."). Sem markdown extra, apenas "N. prompt".

Tom: reverente, direto, sem clichês. Sem emojis. Sem hashtags. Retorne apenas o texto seguindo a estrutura acima, na ordem indicada.`;
}

export interface ParsedScript {
  narration: string;
  imagePrompts: string[];
}

/**
 * Splits AI output into the narratable script (everything before the IMAGENS: section)
 * and the numbered image prompts that follow.
 */
export function parseScript(raw: string): ParsedScript {
  if (!raw) return { narration: "", imagePrompts: [] };
  const match = raw.match(/^\s*IMAGENS\s*:\s*/im);
  if (!match || match.index === undefined) {
    return { narration: raw.trim(), imagePrompts: [] };
  }
  const narration = raw.slice(0, match.index).trim();
  const after = raw.slice(match.index + match[0].length).trim();
  const prompts = after
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+[.)\-]\s*/, "").trim())
    .filter(Boolean);
  return { narration, imagePrompts: prompts };
}