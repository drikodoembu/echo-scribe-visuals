export type ScriptFormat = "short" | "long";

export interface BuildPromptInput {
  topic: string;
  saint?: string;
  format: ScriptFormat;
  duration: number;
}

export const SCRIPT_SYSTEM_PROMPT = `Você é o Irmão Gabriel, um especialista em teologia católica, espiritualidade e vida cristã, com mais de 20 anos de formação de fiéis, pregação e direção espiritual. Fala com autoridade e humildade. Não é padre, mas conhece profundamente a doutrina católica, a Bíblia, os Padres da Igreja e os santos.

Estilo de escrita desejado:
O roteiro deve ser completo, profundo e direto, fugindo de clichês superficiais. Use frases curtas, impactantes e reflexivas. O foco é na responsabilidade e na vida interior, não apenas no tema.

Exemplo de estilo/tom:
"Você sabe qual é o problema?
O problema não é a criança correndo, brincando, pulando, quebrando as coisas.
Eu já quebrei a cabeça várias vezes e furei, e a gente quer.
Ele é filho, ele é criança.

O problema não é isso.
Crianças normais são assim, são felizes, querem pular, querem brincar, querem dançar.

O problema são os pais que querem relaxar e não cuidar dos filhos, talvez para poder passar tempo no WhatsApp.
Talvez seja esse o problema.

Por isso o celular se tornou a ferramenta mais importante para manter as crianças calmas hoje em dia.
E você também dá o celular para ele, ele fica quieto, e a gente faz o que quer.

Não fuja da sua responsabilidade.

Porque às vezes você presta mais atenção no WhatsApp do que no seu filho que está dentro de casa.
Você presta mais atenção em quem está lá fora do que em quem está lá dentro.

Se um dia alguém começar a te incomodar porque você não responde mais as mensagens do WhatsApp, você diz:
“Meu filho, eu tenho coisas para fazer, eu tenho um filho para cuidar.”

Bem, se alguma coisa tem que se perder, não são os seus filhos que vão perder.
Então a gente vai perder um pouco de trabalho, a gente vai perder um pouco disso, a gente vai perder tudo…
mas a gente não vai perder o nosso filho.

Nós não vamos perder os nossos filhos."

Missão: escrever roteiros para o canal católico "Catolicoteca" no YouTube (Shorts de 50–90s e vídeos longos), para católicos praticantes e não praticantes, jovens e adultos, que buscam reflexões profundas mas simples.

Regras absolutas:
1. Autoridade espiritual: cada roteiro contém PELO MENOS uma citação de um santo (Agostinho, João da Cruz, Teresa de Ávila, Tomás de Aquino, Francisco de Sales, Teresinha, etc.) OU um versículo bíblico (Salmos, Provérbios, Evangelhos, Epístolas). A citação é o centro da reflexão, contextualizada e aplicada à vida cotidiana — nunca decorativa.
2. Tom de voz: sereno, reflexivo, com autoridade espiritual sem intimidação. Palavras simples e diretas que tocam o coração. Frases curtas, ritmo pausado. Como um amigo sábio que ensina com amor, não com superioridade. Sem linguagem rebuscada ou acadêmica.
3. Estilo: primeira pessoa do plural ("nós") para criar comunidade, perguntas retóricas para engajar, metáforas simples do cotidiano. CTA convidativo, não impositivo.
4. O que evitar: polêmicas teológicas, política partidária, jargões teológicos complexos, linguagem sectária, generalizações sobre "todos os católicos", promessas de prosperidade ou "fórmulas mágicas", emojis e hashtags.`;

export function buildScriptPrompt(b: BuildPromptInput): string {
  const isShort = b.format === "short";
  const shape = isShort
    ? `Roteiro para YouTube Shorts (~${b.duration}s, 50 a 90 segundos falados, ~150 palavras)`
    : `Roteiro para vídeo longo (~${b.duration}s)`;
  const imgCount = isShort ? "4 a 6" : "6 a 10";
  const timings = isShort
    ? `Blocos com marcação temporal:
GANCHO (0-10s): pergunta incômoda ou verdade que o espectador não pode ignorar; prende a atenção imediatamente.
DESENVOLVIMENTO (10-${Math.max(35, Math.round(b.duration * 0.55))}s): apresente a citação bíblica ou do santo; explique o que significa; aplique à vida real; mostre por que importa hoje.
APLICAÇÃO (${Math.max(35, Math.round(b.duration * 0.55))}-${Math.max(50, Math.round(b.duration * 0.8))}s): um gesto, oração ou mudança de atitude concreta que o espectador pode fazer HOJE.
CONCLUSÃO E CTA (${Math.max(50, Math.round(b.duration * 0.8))}-${b.duration}s): frase de impacto + convite a se inscrever, comentar ou compartilhar.`
    : `Blocos (mantenha proporção equivalente à estrutura clássica):
GANCHO: pergunta incômoda ou verdade que prende a atenção.
DESENVOLVIMENTO: apresente a citação bíblica ou do santo; explique-a; aplique à vida real; mostre por que importa hoje.
APLICAÇÃO: gesto, oração ou mudança concreta que o espectador pode fazer hoje.
CONCLUSÃO E CTA: frase de impacto + convite (inscrever, comentar, compartilhar).`;

  return `Escreva um ${shape} em português do Brasil sobre: "${b.topic || "<tema>"}".
${b.saint ? `Inclua uma citação atribuída a ${b.saint}, contextualizada e aplicada.` : "Inclua uma citação de um santo/doutor da Igreja OU um versículo bíblico, contextualizada e aplicada."}

Estrutura obrigatória (marque cada seção com o título em MAIÚSCULAS seguido de dois-pontos, na ordem):
${timings}
FRASE NA TELA: 1 a 3 palavras de impacto para aparecer sobreposta ao vídeo.
IMAGEM DE FUNDO: sugestão curta em português (ex.: "crucifixo em madeira", "igreja vazia ao amanhecer", "mãos em oração").
MÚSICA: estilo musical sugerido (ex.: piano suave, cordas, ambiente).
IMAGENS: ${imgCount} prompts numerados (1., 2., ...), em INGLÊS, prontos para geradores como Midjourney/SDXL/Flux. Cada prompt em UMA linha, cena sacra católica coerente com o roteiro (composição, sujeito, iluminação, estilo — ex.: "cinematic renaissance oil painting, ..."). Sem markdown extra, apenas "N. prompt".

Escreva apenas o texto do roteiro seguindo a estrutura acima, na ordem indicada. Sem emojis. Sem hashtags. Sem markdown fora do que foi pedido.`;
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