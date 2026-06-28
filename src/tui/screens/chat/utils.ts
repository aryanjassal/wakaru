import type { SavedWord } from '@/core/types.js';

const DIGRAPHS: Readonly<Record<string, string>> = {
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
};

const KANA: Readonly<Record<string, string>> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  を: 'o',
  ん: 'n',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
};

function hiragana(text: string): string {
  return [...text]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x30a1 && code <= 0x30f6
        ? String.fromCodePoint(code - 0x60)
        : character;
    })
    .join('');
}

export function kanaToRomaji(text: string): string {
  const kana = hiragana(text);
  let result = '';
  let doubleNext = false;
  for (let index = 0; index < kana.length; index += 1) {
    const character = kana[index] ?? '';
    if (character === 'っ') {
      doubleNext = true;
      continue;
    }
    const pair = kana.slice(index, index + 2);
    let syllable = DIGRAPHS[pair];
    if (syllable) index += 1;
    else syllable = KANA[character] ?? character;
    if (doubleNext && syllable) syllable = `${syllable[0] ?? ''}${syllable}`;
    doubleNext = false;
    result += syllable;
  }
  return result.toLowerCase();
}

export function filterSavedWords(
  words: readonly SavedWord[],
  query: string
): readonly SavedWord[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return words;
  return words.filter((word) =>
    [word.expression, word.reading, kanaToRomaji(word.reading), word.meaning]
      .join(' ')
      .toLowerCase()
      .includes(normalized)
  );
}
