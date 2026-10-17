export function scriptSaveFields(title: string, topic: string, content: string) {
  const text = content.trim();
  if (!text) throw new Error("Insira o conteúdo do roteiro antes de salvar.");
  const firstLine = text.split(/\n|(?<=[.!?])\s/)[0]?.trim() || "Roteiro";
  return {
    title: (title.trim() || topic.trim() || firstLine).slice(0, 200),
    topic: (topic.trim() || title.trim() || firstLine).slice(0, 500),
    content: text,
  };
}