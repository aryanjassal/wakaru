# Wakaru

Wakaru is an OpenTUI-based TUI for Japanese word mining. Paste a word or phrase,
optionally add a context sentence, review dictionary senses, then choose which
record to add to a configurable export. A language model ranks contextual senses,
fills missing examples, and handles words absent from the dictionary.

## Workflow

1. Paste a Japanese word or phrase into the Mine screen.
2. Optionally add a context sentence.
3. Run analysis with `ctrl+a`.
4. Review the dictionary meanings ranked for the supplied context.
5. Press `enter` to add the selected word or `x` to skip it.
6. Use `export.tsv` with any downstream tool that accepts tab-separated data.

Saved words are stored as JSON. The configured columns can be written to TSV
from the library screen.

## Requirements

- Node.js 26.3.0 or newer with experimental FFI support.
- An OpenAI-compatible model endpoint. Ollama is the default.
- A model available through that endpoint, such as `qwen3.5:9b`.

## Quickstart

```bash
npm install
npm run build
npm run start:tui
```

`npm run start:tui` runs Node with `--experimental-ffi`, which OpenTUI needs to
create the native renderer.

By default, Wakaru calls the OpenAI-compatible API exposed by Ollama at
`http://localhost:11434` and writes files to `~/.config/wakaru/words`.

## Config

Copy `config.example.json` to `~/.config/wakaru/config.json` and adjust the
model endpoint if required.

Wakaru validates user-authored JSON with Zod and reports field-level errors.

## Keybindings

| Key           | Command              |
| ------------- | -------------------- |
| `q`, `ctrl+c` | Quit                 |
| `1`           | Mine screen          |
| `2`           | Library screen       |
| `3`           | Settings screen      |
| `left/right`  | Previous/next screen |
| `tab`         | Next input field     |
| `shift+tab`   | Previous input field |
| `ctrl+a`      | Analyse word         |
| `enter`       | Add selected word    |
| `up/down`     | Select candidate     |
| `x`           | Skip selected word   |
| `c`           | Clear Mine screen    |
| `d`           | Toggle details       |
| `ctrl+e`      | Write TSV export     |

## Development

Build the local English dictionary after downloading `JMdict.xml` and
`JMnedict.xml` into `assets/source/`:

```bash
npm run build:dictionary
```

The runtime reads `assets/runtime/dictionary.sqlite`; it does not parse XML.
The build force-pushes the current Drizzle schema into a temporary database,
imports the XML, and atomically replaces the previous database after success.
Migration history is intentionally not maintained during alpha. Custom paths
can be supplied when refreshing the data:

```bash
npm run build:dictionary -- \
  --jmdict path/to/JMdict.xml \
  --jmnedict path/to/JMnedict.xml \
  --output assets/runtime/dictionary.sqlite
```

`npm run build` creates `dist/`, bundles the application and Kuromoji code, and
copies the SQLite and Kuromoji runtime data into `dist/assets/`. Raw XML is
excluded. `npm run package:runtime` also installs the OpenTUI and SQLite native
dependencies into `dist/node_modules`; after that, the entire `dist/` directory
can be moved and run with `npm start` from any working directory. Build release
archives separately for each operating system and CPU architecture because
those two dependencies contain platform-specific binaries.

Set `WAKARU_DICTIONARY` or `WAKARU_TOKENISER_DICTIONARY` to override packaged
assets, and `WAKARU_WORDS_DIR` to override the TUI's saved-word directory.

### API boundaries

`src/core` contains runtime-independent contracts and orchestration. The
default Node client assembles Kuromoji, JMdict SQLite, and an OpenAI-compatible
model adapter:

```ts
import { createWakaru, loadConfig } from './src/client/index.js';

const wakaru = createWakaru({
  config: loadConfig(),
  dictionaryPath: './assets/runtime/dictionary.sqlite',
  tokeniserDictionaryPath: './assets/runtime/kuromoji',
});

const result = await wakaru.analyseVocabulary({ expression: '稼いで' });
```

Downstream clients can inject any structurally compatible vocabulary and
conversation services with `createCustomWakaru()`. Core does not import Node,
the client, or concrete providers.

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

Use `npm run format` to apply Prettier formatting. Markdown is wrapped at 80
columns through `prettier.config.js`.
