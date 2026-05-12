---
applyTo: "**/*.json"
---

Localization JSON files are generated artifacts.

Do not manually edit:
- `/src/locales/en.json`
- `/src/locales/vi.json`

Instead:
1. Update `/tools/languages.xlsx`
2. Run:

```sh
./tools/convert.sh
```
3. Use generated output only.
