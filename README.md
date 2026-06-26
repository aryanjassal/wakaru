# Wakaru

Wakaru is an OpenTUI-based TUI for Japanese sentence and word mining. Paste a
sentence, paragraph, or short list of words, ask a local Ollama model to explain
useful candidates in context, then choose which cards to add to an Anki import
file.

## Workflow

1. Paste Japanese text into the Mine screen.
2. Run analysis with `ctrl+a`.
3. Review the model's candidates and context-specific meanings.
4. Press `enter` to add the selected candidate or `x` to skip it.
5. Import `anki-import.tsv` from the configured words directory into Anki.

Saved words are stored as JSON and the Anki TSV is regenerated whenever a word
is added.

## Requirements

- Node.js 26.3.0 or newer with experimental FFI support.
- Ollama running locally.
- A local model available through Ollama, such as `qwen3.5:9b`.

## Quickstart

```bash
npm install
npm run start:tui
```

`npm run start:tui` runs Node with `--experimental-ffi`, which OpenTUI needs to
create the native renderer.

By default, Wakaru calls Ollama at `http://localhost:11434` and writes files to
`~/.config/wakaru/words`.

## Config

Copy `docs/config.example.json` to `~/.config/wakaru/config.json` and adjust
the model or storage directory.

```json
{
  "llm": {
    "provider": "ollama",
    "model": "qwen3.5:9b",
    "apiBase": "http://localhost:11434"
  },
  "storage": {
    "wordsDir": "~/.config/wakaru/words"
  },
  "theme": {
    "name": "night"
  }
}
```

Wakaru validates user-authored JSON with Zod and reports field-level errors.
Invalid Ollama candidate responses are appended to
`~/.config/wakaru/ollama-failures.jsonl` for debugging.

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
| `ctrl+a`      | Analyze pasted text  |
| `ctrl+w`      | Analyze custom word  |
| `enter`       | Add selected word    |
| `up/down`     | Select candidate     |
| `x`           | Skip selected word   |
| `c`           | Clear Mine screen    |
| `space`       | Paste clipboard      |
| `d`           | Toggle details       |
| `ctrl+e`      | Rewrite Anki TSV     |

## Development

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
```

Use `npm run format` to apply Prettier formatting. Markdown is wrapped at 80
columns through `prettier.config.js`.
