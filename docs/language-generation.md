# Localization Workflow

## Overview

Localization files are generated artifacts.

**Never edit localization JSON files directly.**

Source of truth:
* `tools/languages.csv`

Derived artifact (auto-synced, do not edit directly):
* `tools/languages.xlsx`

Generated files (auto-generated, do not edit):
* `frontend/src/locales/en.json`
* `frontend/src/locales/vi.json`

---

## Workflow Overview

```
Edit /tools/languages.csv
        ↓
Run generate-locales.sh
  ├─ syncs languages.xlsx from CSV
  └─ generates JSON from CSV
        ↓
JSON files auto-generated in frontend/src/locales/
```

---

## Step-by-Step Instructions

### 1. Edit CSV File

Edit `tools/languages.csv` with your new/updated translation keys.

**Format:** `key;English;Vietnamese` (semicolon-separated)

**Example:**
```csv
undo.messages.success;Move undone successfully;Hoàn tác nước đi thành công
draw-game.messages.forbidden;You are not in this room;Bạn không có trong phòng này
```

Key naming convention: `feature.category.message`
- Feature: `undo`, `draw-game`, `surrender`, etc.
- Category: `messages`, `actions`, `button`, etc.
- Message: descriptive name in kebab-case

### 2. Generate JSON Locales

From the `tools/` directory:

```bash
./tools/generate-locales.sh
```

This script:
1. Syncs `tools/languages.xlsx` from `tools/languages.csv`
2. Generates `frontend/src/locales/en.json` and `frontend/src/locales/vi.json` from the CSV

### 3. Verify

Check that your keys appear in both JSON files:

```bash
grep "undo.messages.success" frontend/src/locales/en.json
grep "undo.messages.success" frontend/src/locales/vi.json
```

---

## Excel Structure (Reference)

Columns:
1. Translation key (e.g., `page.home.title`)
2. English translation
3. Vietnamese translation

Example:

| Key             | English   | Vietnamese |
| --------------- | --------- | ---------- |
| page.home.title | Home Page | Trang chủ  |
| undo.messages.success | Move undone successfully | Hoàn tác nước đi thành công |

---

## JSON Mapping (Reference)

Excel entry:
```
undo.messages.success
English: Move undone successfully
Vietnamese: Hoàn tác nước đi thành công
```

Generates in JSON:
```json
{
  "undo": {
    "messages": {
      "success": "Move undone successfully"
    }
  }
}
```

---

## Forbidden Actions ❌

**Never manually edit:**
- `frontend/src/locales/en.json`
- `frontend/src/locales/vi.json`

These are generated artifacts. Any manual edits will be overwritten.

**If these files were edited directly:**
1. Discard the manual changes with `git checkout`
2. Update `/tools/languages.csv` instead
3. Run generation workflow above

---

## Expected Agent Behavior

When adding/updating localization, agents must:

1. ✅ Edit `/tools/languages.csv`
2. ✅ Run `cd /tools && python3 update-excel-from-csv.py`
3. ✅ Run `./tools/generate-locales.sh` (from project root)
4. ✅ Verify generated files contain the keys
5. ❌ **Never** edit JSON locale files directly

---

## Common Examples

### Adding API Error Messages
```csv
move-piece.messages.invalid-fen;Invalid FEN string;Chuỗi FEN không hợp lệ
move-piece.messages.game-not-found;Game not found;Không tìm thấy trò chơi
move-piece.messages.success;Move recorded successfully;Ghi nhận nước đi thành công
```

### Adding Feature Buttons
```csv
room.actions.undo;Undo;Hoàn tác
room.actions.confirm-undo;Are you sure you want to undo?;Bạn chắc chắn muốn hoàn tác?
```

### Updating Existing Translation
Find the key in `/tools/languages.csv` and update the English/Vietnamese columns, then regenerate.

---

## Files Involved

| File | Purpose | Edited By |
|------|---------|-----------|
| `/tools/languages.csv` | Source data for translations | ✏️ You (text editor) |
| `/tools/languages.xlsx` | Excel backup of CSV | 🔄 Auto (update-excel-from-csv.py) |
| `frontend/src/locales/en.json` | Generated English locales | 🔄 Auto (generate-locales.sh) |
| `frontend/src/locales/vi.json` | Generated Vietnamese locales | 🔄 Auto (generate-locales.sh) |

---

## Troubleshooting

**Q: JSON files aren't updating after I edited CSV**
A: Make sure you ran both scripts:
1. `cd /tools && python3 update-excel-from-csv.py`
2. From root: `./tools/generate-locales.sh`

**Q: My changes disappeared from JSON**
A: You probably edited JSON directly. Revert with `git checkout frontend/src/locales/` and use CSV workflow instead.

**Q: I got a Python error**
A: Make sure you're in the `/tools` directory when running Python scripts, and project root when running bash scripts.
