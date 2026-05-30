# Language generation workflow

## IMPORTANT
- Do NOT edit generated JSON files directly (`frontend/src/locales/vi.json`, `frontend/src/locales/en.json`)
- Source of truth is the Excel file: `/tools/languages.xlsx`

## When updating JSON
1. Modify the Excel file first
Normally, if you add a JSON file with this structure...
{
	...
	"page": {
		"home": {
			"title": "Home page"
		}
	}
}
It's equivalent to adding this line to the Excel file.
First column: `page.home.title`
2nd column: English
3rd column: Vietnamese
2. Run:

```sh
./tools/generate-locales.sh
```
