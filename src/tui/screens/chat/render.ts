const CURLY_FURIGANA = /\{([^{}\n|]+)\|([^{}\n|]+)\}/gu;
const BRACKET_FURIGANA =
  /([\p{Script=Han}\u3005\u3006\u30f5\u30f6]+)\[([\p{Script=Hiragana}\p{Script=Katakana}\u30fc\s]+)\]/gu;

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
  return markdown
    .replace(CURLY_FURIGANA, (_match, surface: string, reading: string) =>
      renderReading(surface, reading, showFurigana)
    )
    .replace(BRACKET_FURIGANA, (_match, surface: string, reading: string) =>
      renderReading(surface, reading, showFurigana)
    );
}
