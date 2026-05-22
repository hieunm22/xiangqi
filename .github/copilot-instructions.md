# Localization workflow

IMPORTANT:
- Never edit `/src/locales/en.json` directly
- Never edit `/src/locales/vi.json` directly
- These files are generated files

Source of truth:
- `/tools/languages.xlsx`

Excel structure:
- Column 1: language key
- Column 2: English value
- Column 3: Vietnamese value

Example:
- `page.login.username.label`
- `User name`
- `Tên người dùng`

When adding or updating translations:
1. Modify `/tools/languages.xlsx`
2. Run:

```sh
./tools/generate-locales.sh
```
3. Verify generated JSON changes

Always prefer updating the Excel source instead of editing generated JSON files.
