const CURLY_FURIGANA = /\{([^{}\n|]+)\|([^{}\n|]+)\}/gu;

function renderReading(
  surface: string,
  reading: string,
  visible: boolean
): string {
  return visible ? `${surface} \`[${reading}]\`` : surface;
}

export function preprocessChatMarkdown(
  markdown: string,
  showFurigana: boolean
): string {
  return markdown.replace(
    CURLY_FURIGANA,
    (_match, surface: string, reading: string) =>
      renderReading(surface, reading, showFurigana)
  );
}
