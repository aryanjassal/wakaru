import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const dictionarySources = ['jmdict', 'jmnedict'] as const;
export type DictionarySource = (typeof dictionarySources)[number];

export const formKinds = ['written', 'reading'] as const;
export type FormKind = (typeof formKinds)[number];

export const metadata = sqliteTable('metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const entries = sqliteTable(
  'entry',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source', { enum: dictionarySources }).notNull(),
    sequence: integer('sequence').notNull(),
  },
  (table) => [
    uniqueIndex('entry_source_sequence_idx').on(table.source, table.sequence),
  ]
);

export type EntryRow = Readonly<{
  id: number;
  source: DictionarySource;
  sequence: number;
}>;

export const forms = sqliteTable(
  'form',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entryId: integer('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    kind: text('kind', { enum: formKinds }).notNull(),
    priority: integer('priority').notNull().default(0),
    restrictions: text('restrictions', { mode: 'json' })
      .$type<readonly string[]>()
      .notNull(),
  },
  (table) => [
    index('form_text_idx').on(table.text),
    index('form_entry_idx').on(table.entryId),
  ]
);

export type FormRow = Readonly<{
  entryId: number;
  text: string;
  kind: FormKind;
  priority: number;
  restrictions: readonly string[];
}>;

export const senses = sqliteTable(
  'sense',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entryId: integer('entry_id')
      .notNull()
      .references(() => entries.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    partOfSpeech: text('part_of_speech', { mode: 'json' })
      .$type<readonly string[]>()
      .notNull(),
    information: text('information', { mode: 'json' })
      .$type<readonly string[]>()
      .notNull(),
    restrictions: text('restrictions', { mode: 'json' })
      .$type<readonly string[]>()
      .notNull(),
  },
  (table) => [
    index('sense_entry_idx').on(table.entryId),
    uniqueIndex('sense_entry_position_idx').on(table.entryId, table.position),
  ]
);

export const glosses = sqliteTable(
  'gloss',
  {
    senseId: integer('sense_id')
      .notNull()
      .references(() => senses.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    text: text('text').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.senseId, table.position] }),
    index('gloss_sense_idx').on(table.senseId),
  ]
);

export type SenseRow = Readonly<{
  id: number;
  entryId: number;
  position: number;
  partOfSpeech: readonly string[];
  information: readonly string[];
  restrictions: readonly string[];
  glossPosition: number;
  gloss: string;
}>;
