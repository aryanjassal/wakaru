import { describe, expect, it } from '@jest/globals';
import {
  FormattingSyntaxError,
  formattedTextToHtml,
  parseFormattedText,
} from '@/core/formatting.js';
import { DEFAULT_HTML_FORMATTING } from '@/core/schemas.js';

describe('canonical field formatting', () => {
  it('parses the single supported readable syntax', () => {
    expect(
      parseFormattedText('**bold** *italic* __underline__ {開発|かいはつ}')
    ).toEqual([
      { kind: 'bold', value: 'bold' },
      { kind: 'text', value: ' ' },
      { kind: 'italic', value: 'italic' },
      { kind: 'text', value: ' ' },
      { kind: 'underline', value: 'underline' },
      { kind: 'text', value: ' ' },
      { kind: 'reading', expression: '開発', reading: 'かいはつ' },
    ]);
  });

  it('does not treat bracket readings as formatting', () => {
    expect(parseFormattedText('開発[かいはつ]')).toEqual([
      { kind: 'text', value: '開発[かいはつ]' },
    ]);
  });

  it('supports escaped literal formatting characters', () => {
    expect(parseFormattedText('**C\\* syntax**')).toEqual([
      { kind: 'bold', value: 'C* syntax' },
    ]);
  });

  it('rejects malformed and nested formatting', () => {
    expect(() => parseFormattedText('**__nested__**')).toThrow(
      FormattingSyntaxError
    );
    expect(() => parseFormattedText('{開発}')).toThrow(
      /must be \{expression\|reading\}/
    );
    expect(() => parseFormattedText('<strong>bold</strong>')).toThrow(
      /HTML is not allowed/
    );
  });

  it('exports escaped HTML through configurable templates', () => {
    expect(
      formattedTextToHtml('**A < B** {開発|かいはつ}', DEFAULT_HTML_FORMATTING)
    ).toBe('<strong>A &lt; B</strong> <ruby>開発<rt>かいはつ</rt></ruby>');

    expect(
      formattedTextToHtml('{開発|かいはつ}', {
        ...DEFAULT_HTML_FORMATTING,
        readingTemplate: '{{expression}}[{{reading}}]',
      })
    ).toBe('開発[かいはつ]');
  });
});
