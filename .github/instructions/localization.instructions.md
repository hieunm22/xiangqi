---
applyTo: "**/*.json"
---

Localization JSON files are generated artifacts.

Do not manually edit:
- `frontend/src/locales/en.json`
- `frontend/src/locales/vi.json`

Source of truth is `tools/languages.csv`. To add or update translations:
1. Edit `tools/languages.csv` (format: `key;English;Vietnamese`)
2. Run:

```sh
./tools/generate-locales.sh
```

This syncs `tools/languages.xlsx` and regenerates both JSON files. Use generated output only.

3. Use generated output only.
