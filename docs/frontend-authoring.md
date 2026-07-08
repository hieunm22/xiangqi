# Frontend Authoring Convention

Full reference for the Copilot instruction
`.github/instructions/frontend-authoring.instructions.md`
(`applyTo: "frontend/src/**/*.{ts,tsx}"`). Covers how to author types and how to
style MUI components. Import/export/destructuring formatting lives in
`docs/react-guidelines.md`.

## Types and interfaces: minimize optional fields

An optional (`?`) field forces every consumer to narrow `undefined` and blurs
whether the value is truly absent or just wasn't set. Default to required fields.

Rules:

* Do not mark a field optional just because it "might not always be set". Make it
  required and supply a concrete value where the object is constructed.
* If a field maps to a **nullable database column**, model it as a required field
  whose type includes `| null` — not as optional `?`. This mirrors the row
  shape: the key is always present; its value may be `null`. Keep the field name
  matching the column (usually `snake_case`).
* Reserve `?` for fields genuinely absent from the object in some shapes:
  optional React props, discriminated-union variants, partial/patch payloads.

```ts
// Good — required fields; nullable columns typed with | null
export interface RoomUser {
	id: number
	display_name: string
	avatar_url: string | null
	host_id: number | null
}

// Bad — optional stand-ins for values that always exist on the row
export interface RoomUser {
	id?: number
	display_name?: string
	avatar_url?: string
}
```

Existing examples in the codebase: `frontend/src/pages/Room/types.ts`,
`frontend/src/pages/Dashboard/types.ts`.

## MUI components: prefer the colocated stylesheet over `sx`

Styling belongs in the component's colocated `.scss` file, applied with
`className`. Keep `sx` for the few things CSS cannot express.

Rules:

* Each page/component folder has a stylesheet named after the folder — e.g.
  `frontend/src/pages/Room/Room.scss`,
  `frontend/src/components/Layout/Layout.scss`. Add styles there and reference
  them via `className`.
* Do not use `sx` for CSS-expressible properties: spacing, layout, flexbox,
  sizing, `display`, `gap`, plain color values, etc.
* Use `sx` only for values CSS cannot express:
  * MUI theme tokens — `color: "primary.main"`,
    `backgroundColor: "primary.text"`, `borderColor: "primary.main"`
  * MUI slot selectors — `"& .MuiDialog-paper": { ... }`
* When both are needed, combine `className` (CSS-expressible styles) with a
  minimal `sx` (theme tokens / slot overrides only).

```tsx
// Good
<Box className="lucky-wheel-actions">
	<Divider sx={{ borderColor: "primary.main" }} />
</Box>
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

```tsx
// Bad — CSS-expressible styles crammed into sx
<Box sx={{ display: "flex", gap: 1, mt: 4, alignItems: "center", width: "100%" }}>
```
