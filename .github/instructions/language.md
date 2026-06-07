# Language generation workflow

## ⚠️ IMPORTANT - DO NOT EDIT JSON FILES DIRECTLY

- **Never** edit generated JSON files: `frontend/src/locales/vi.json`, `frontend/src/locales/en.json`
- Source of truth is the Excel file: `/tools/languages.xlsx` (synchronized with `/tools/languages.csv`)
- Any manual JSON edits will be overwritten when the generation script runs

## Workflow for Adding/Updating Localization

### 1. Update the CSV file
Edit `/tools/languages.csv` with your new language keys:
- First column: `namespace.key.path` (e.g., `undo.messages.success`)
- 2nd column: English translation
- 3rd column: Vietnamese translation

Format (semicolon-separated):
```
undo.messages.success;Move undone successfully;Hoàn tác nước đi thành công
```

### 2. Sync Excel from CSV
From `/tools` directory, run:
```sh
python3 update-excel-from-csv.py
```

### 3. Generate JSON locales
From project root, run:
```sh
./tools/generate-locales.sh
```

This will:
- Read from `/tools/languages.xlsx`
- Generate `/frontend/src/locales/en.json`
- Generate `/frontend/src/locales/vi.json`

### ✅ Verification
After generation, verify your keys appear in:
```sh
grep "your-key-name" frontend/src/locales/en.json
grep "your-key-name" frontend/src/locales/vi.json
```

## Example Workflow

Adding undo API localization:

```csv
# In /tools/languages.csv, add:
undo.messages.invalid-game-id;Invalid game ID;ID trò chơi không hợp lệ
undo.messages.success;Move undone successfully;Hoàn tác nước đi thành công
```

Then run:
```sh
cd /tools && ./tools/generate-locales.sh
```

## Files Modified During Workflow

- ✏️ `/tools/languages.csv` - **You edit this**
- ✏️ `/tools/languages.xlsx` - **Auto-updated by update-excel-from-csv.py**
- 🔄 `frontend/src/locales/en.json` - **Auto-generated, never edit directly**
- 🔄 `frontend/src/locales/vi.json` - **Auto-generated, never edit directly**
