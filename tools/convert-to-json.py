import csv
import datetime
import json
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

# Load CSV
nested_en = {}
nested_vi = {}

with open("languages.csv", "r", encoding="utf-8-sig") as f:
  reader = csv.reader(f, delimiter=";")
  next(reader)  # Skip header
  for row in reader:
    if row and len(row) >= 3:
      full_key, en, vi = row[0], row[1], row[2]
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
    f.write(text + "\n")

write_json("frontend/src/locales/en.json", nested_en)
write_json("frontend/src/locales/vi.json", nested_vi)

print("✅ Export successfully at", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
