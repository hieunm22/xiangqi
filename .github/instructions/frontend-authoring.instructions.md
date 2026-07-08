---
applyTo: "frontend/src/**/*.{ts,tsx}"
---

# Frontend Authoring Convention

Rules for authoring frontend types and MUI components. Also see
`frontend-style.instructions.md` for import/export/destructuring formatting.

## Types and interfaces

Minimize optional (`?`) fields — an optional field forces every consumer to
handle `undefined` and hides intent. Prefer a required field.

* Do **not** mark a field optional just because it "might not always be set".
  Make it required and provide a concrete value at the call site.
* If a field maps to a **nullable database column**, model absence as `| null`
  (a required field whose value can be `null`), **not** as optional `?`.
  Keep the field name matching the DB column (usually `snake_case`).
* Reserve `?` for fields that are genuinely absent from the object in some
  shapes (e.g. optional React props, discriminated-union variants).

```ts
// Good — DB-nullable columns are required + nullable, matching the column name
export interface RoomUser {
	id: number
	display_name: string
	avatar_url: string | null
	host_id: number | null
}

// Bad — optional used for values that always exist on the row
export interface RoomUser {
	id?: number
	display_name?: string
	avatar_url?: string
}
```

## MUI components and styling

Put styling in the component's colocated `.scss` file and apply it with
`className`. Minimize `sx`.

* Every page/component folder has a colocated stylesheet named after the folder
  (e.g. `pages/Room/Room.scss`, `components/Layout/Layout.scss`). Add styles
  there and reference them via `className`.
* Do **not** use `sx` for properties that CSS can express (spacing, layout,
  flexbox, sizing, `display`, `gap`, plain colors, etc.).
* Use `sx` **only** for values CSS cannot express, mainly MUI theme tokens and
  deep component-slot overrides:
  * theme-token values — `color: "primary.main"`, `backgroundColor: "primary.text"`, `borderColor: "primary.main"`
  * slot selectors on an MUI component — `"& .MuiDialog-paper": { ... }`
* When both are needed, combine: `className` for the CSS-expressible styles plus
  a minimal `sx` for the theme-token/slot bits.

```tsx
// Good — layout/spacing in scss via className, sx only for the theme token
<Box className="lucky-wheel-actions">
	<Divider sx={{ borderColor: "primary.main" }} />
</Box>
```

```tsx
// Bad — CSS-expressible styles crammed into sx
<Box sx={{ display: "flex", gap: 1, mt: 4, alignItems: "center", width: "100%" }}>
```

```scss
// Room.scss
.lucky-wheel-actions {
	display: flex;
	gap: 8px;
	margin-top: 32px;
	align-items: center;
	width: 100%;
}
```
