import datetime
import json
import openpyxl
import pathlib
from pathlib import Path
import os

def insert_nested(dictionary, keys, value):
  key = keys[0]
  if len(keys) == 1:
    dictionary[key] = value
  else:
    if key not in dictionary:
      dictionary[key] = {}
    insert_nested(dictionary[key], keys[1:], value)

# Load Excel
wb = openpyxl.load_workbook("languages.xlsx")
ws = wb.active

nested_en = {}
nested_vi = {}

# Remove header row
for row in ws.iter_rows(min_row=2, values_only=True):
  if row and len(row) >= 2:
    full_key, en, vi = row
    if full_key:
      key_parts = str(full_key).split(".")
      insert_nested(nested_en, key_parts, str(en) if en else "")
      insert_nested(nested_vi, key_parts, str(vi) if vi else "")

# Write JSON with tab format
def write_json(filename, data):
  path = pathlib.Path().resolve()
  path = Path(path)
  parent = path.parent.absolute()
  filename = os.path.abspath(os.path.join(parent, filename))

  text = json.dumps(data, ensure_ascii=False, indent=4)
  text = text.replace("    ", "\t")
  with open(filename, "w", encoding="utf-8") as f:
    f.write(text)

write_json("frontend/src/locales/en.json", nested_en)
write_json("frontend/src/locales/vi.json", nested_vi)

print("✅ Export successfully at", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
