# Assets

`source/` contains the upstream JMdict and JMnedict XML used to rebuild the
local dictionary. `runtime/` contains only files required while Wakaru runs:

```text
source/
  JMdict.xml
  JMnedict.xml
runtime/
  dictionary.sqlite
  kuromoji/*.dat.gz
```

The large source and generated files are intentionally ignored by Git. GitHub's
normal repository storage cannot accept the SQLite database or JMnedict XML.
Release builds should publish them as release assets, use Git LFS, or obtain
them through a future cache downloader.

Running `npm run build` copies `runtime/` to `dist/assets/`. Raw XML is not
included in the runtime distribution. Running `npm run package:runtime` also
stages the current platform's native dependencies, producing a directory that
can be moved without retaining this source checkout or its `node_modules`.
