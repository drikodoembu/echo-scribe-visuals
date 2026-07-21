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
  return `Você é um roteirista católico fiel ao Magistério da Igreja.
Escreva um ${shape} em português do Brasil sobre: "${b.topic || "<tema>"}".
${b.saint ? `Inclua uma citação atribuída a ${b.saint}.` : "Inclua uma citação de um santo ou doutor da Igreja."}

Estrutura obrigatória (marque cada seção com título em MAIÚSCULAS seguido de dois-pontos):
GANCHO: 1-2 frases de impacto.
CITAÇÃO: frase do santo + nome.
APLICAÇÃO: aplicação prática à vida cristã hoje.
CHAMADA: convite para seguir o canal e viver o Evangelho.

Tom: reverente, direto, sem clichês. Sem emojis. Sem hashtags. Apenas o texto do roteiro.`;
}