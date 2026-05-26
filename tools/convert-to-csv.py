import argparse
import csv
import datetime
from pathlib import Path

import openpyxl


def export_excel_to_csv(excel_path: Path, output_dir: Path) -> int:
  workbook = openpyxl.load_workbook(excel_path, data_only=False)
  output_dir.mkdir(parents=True, exist_ok=True)

  csv_path = output_dir / "languages.csv"

  with csv_path.open("w", newline="", encoding="utf-8-sig") as csv_file:
    writer = csv.writer(csv_file, delimiter=";")

    for sheet in workbook.worksheets:
      for row in sheet.iter_rows(values_only=True):
        writer.writerow(["" if value is None else value for value in row])

  return len(workbook.worksheets)


def main() -> None:
  script_dir = Path(__file__).resolve().parent

  parser = argparse.ArgumentParser(description="Export all Excel sheets to CSV files")
  parser.add_argument(
    "--input",
    default=str(script_dir / "languages.xlsx"),
    help="Path to Excel file (default: tools/languages.xlsx)",
  )
  parser.add_argument(
    "--output-dir",
    default=str(script_dir),
    help="Directory to write CSV files (default: tools)",
  )

  args = parser.parse_args()
  excel_path = Path(args.input).expanduser().resolve()
  output_dir = Path(args.output_dir).expanduser().resolve()

  if not excel_path.exists():
    raise FileNotFoundError(f"Excel file not found: {excel_path}")

  exported = export_excel_to_csv(excel_path, output_dir)

  print(
    f"✅ Exported {exported} sheet(s) to {output_dir} at "
    f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
  )


if __name__ == "__main__":
  main()
