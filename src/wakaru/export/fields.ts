import type { ClientConfig } from '../schema/config.js';
import type { ClientCandidate } from '../types.js';

type ExportContext = Readonly<{
  id: string;
  sourceText: string;
  createdAt: string;
}>;

function inheritedValue(
  candidate: ClientCandidate,
  inherit: Extract<
    ClientConfig['export']['fields'][number],
    { inherit: unknown }
  >['inherit'],
  context: ExportContext
): string {
  switch (inherit) {
    case 'id':
      return context.id;
    case 'expression':
      return candidate.expression;
    case 'reading':
      return candidate.reading ?? '';
    case 'meaning':
      return candidate.meanings.join('; ');
    case 'contextMeaning':
      return candidate.details?.contextMeaning ?? '';
    case 'partOfSpeech':
      return candidate.details?.partOfSpeech?.join(', ') ?? '';
    case 'exampleJapanese':
      return candidate.details?.example?.japanese ?? '';
    case 'exampleEnglish':
      return candidate.details?.example?.english ?? '';
    case 'tags':
      return candidate.extension?.tags.join(' ') ?? '';
    case 'sourceText':
      return context.sourceText;
    case 'createdAt':
      return context.createdAt;
    default:
      return inherit satisfies never;
  }
}

export function materialiseExportFields(
  config: ClientConfig,
  candidate: ClientCandidate,
  context: ExportContext
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    config.export.fields.map((field) => [
      field.key,
      'inherit' in field
        ? inheritedValue(candidate, field.inherit, context)
        : (candidate.extension?.exportFields[field.key] ?? ''),
    ])
  );
}
