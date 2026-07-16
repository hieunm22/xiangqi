---
applyTo: "{frontend,backend}/src/**/*.{ts,tsx}"
---

# Type Modeling Convention

Rules for authoring TypeScript types and interfaces across **both** the frontend
and the backend. Frontend-only MUI styling lives in
`frontend-authoring.instructions.md`; import/export/destructuring formatting
lives in `frontend-style.instructions.md`.

## Types and interfaces: minimize optional fields

Minimize optional (`?`) fields — an optional field forces every consumer to
handle `undefined` and hides intent. Prefer a required field.

* Do **not** mark a field optional just because it "might not always be set".
  Make it required and provide a concrete value at the call site.
* If a field maps to a **nullable database column**, model absence as `| null`
  (a required field whose value can be `null`), **not** as optional `?`. Keep
  the field name matching the DB column (usually `snake_case`).
* If a field maps to a **NOT NULL column** and is always present, make it plainly
  required (`field: T`) — neither `?` nor `| null`.
* Avoid `field?: T | null` — that declares three states (absent / null / value),
  which a row or response almost never has. Pick optional `?` **or** required
  nullable `| null`, not both.
* Reserve `?` for fields genuinely absent in some shapes: optional React props,
  discriminated-union variants, and partial/patch request payloads.

Decide per field: if the response/row **omits** the key in some shapes → `?`;
else if the value can be `null` → `field: T | null`; else → `field: T`.

```ts
// Good — NOT NULL columns required; nullable columns required + | null
export interface RoomUser {
	id: number
	display_name: string
	avatar_url: string | null
	team: Team | null
	total_amount: number
	is_bot: boolean
}

// Bad — optional used for values that always exist on the row
export interface RoomUser {
	id?: number
	display_name?: string
	avatar_url?: string
	total_amount?: number
}
```

Full reference: `docs/type-modeling.md`.
