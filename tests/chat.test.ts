import { describe, expect, it } from '@jest/globals';
import type { SavedWord } from '@/core/types.js';
import {
  findChatCommand,
  matchingChatCommands,
  parseTemperature,
  removeChatCommand,
} from '@/tui/screens/chat/commands.js';
import { preprocessChatMarkdown } from '@/tui/screens/chat/render.js';
import { filterSavedWords, kanaToRomaji } from '@/tui/screens/chat/utils.js';

const WORD: SavedWord = {
  id: 'word-1',
  expression: '警察官',
  reading: 'けいさつかん',
  meaning: 'police officer',
  contextMeaning: 'police officer',
  partOfSpeech: 'noun',
  exampleJapanese: '私は警察官です。',
  exampleEnglish: 'I am a police officer.',
  tags: ['noun'],
  exportFields: { word: '警察官' },
  sourceText: '私は警察官です。',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('Chat word search', () => {
  it('converts kana to romaji for saved-word filtering', () => {
    expect(kanaToRomaji('けいさつかん')).toBe('keisatsukan');
    expect(filterSavedWords([WORD], 'keisatsu')).toEqual([WORD]);
  });
});

describe('Chat commands', () => {
  it('finds and removes a command anywhere before the cursor', () => {
    const text = 'Please compare these /temperature 0.2';
    const command = findChatCommand(text, text.length);

    expect(command).not.toBeNull();
    expect(command?.name).toBe('temperature');
    expect(command?.args).toEqual(['0.2']);
    expect(removeChatCommand(text, command!)).toBe('Please compare these ');
    expect(matchingChatCommands(command!)[0]?.id).toBe('temperature');
  });

  it('validates the supported temperature range', () => {
    expect(parseTemperature('0')).toBe(0);
    expect(parseTemperature('1.25')).toBe(1.25);
    expect(parseTemperature('2.1')).toBeNull();
    expect(parseTemperature('hot')).toBeNull();
  });
});

describe('Chat furigana rendering', () => {
  it('hides readings by default and exposes muted-code annotations on demand', () => {
    const markdown = 'Use {開発|かいはつ} and 警察官[けいさつかん].';

    expect(preprocessChatMarkdown(markdown, false)).toBe(
      'Use 開発 and 警察官[けいさつかん].'
    );
    expect(preprocessChatMarkdown(markdown, true)).toBe(
      'Use 開発 `[かいはつ]` and 警察官[けいさつかん].'
    );
  });
});
