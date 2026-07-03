export type FormattedTextToken =
  | Readonly<{ kind: 'text'; value: string }>
  | Readonly<{ kind: 'bold'; value: string }>
  | Readonly<{ kind: 'italic'; value: string }>
  | Readonly<{ kind: 'underline'; value: string }>
  | Readonly<{ kind: 'reading'; expression: string; reading: string }>;

export type HtmlFormattingConfig = Readonly<{
  boldTemplate: string;
  italicTemplate: string;
  underlineTemplate: string;
  readingTemplate: string;
  lineBreak: string;
}>;
