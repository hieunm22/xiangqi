# Type Modeling Convention

Full reference for the Copilot instruction
`.github/instructions/type-modeling.instructions.md`
(`applyTo: "{frontend,backend}/src/**/*.{ts,tsx}"`). Applies to **both** the
frontend and the backend — anywhere TypeScript types/interfaces are authored.

Frontend-only MUI styling rules live in `docs/frontend-authoring.md`.
Import/export/destructuring formatting lives in `docs/react-guidelines.md`.

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
* If a field maps to a **NOT NULL column** and is always present on the object,
  make it plainly required (`field: T`) — neither `?` nor `| null`.
* Avoid combining `?` with `| null` (`field?: T | null`). That declares three
  states — absent, present-but-null, present-with-value — which is almost never
  what a row or a response actually has. Pick one: optional `?` (sometimes
  absent) or required nullable `| null` (always present, value may be null).
* Reserve `?` for fields genuinely absent from the object in some shapes:
  optional React props, discriminated-union variants, and partial/patch request
  payloads where the caller sends only the keys it wants to change.

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

// Bad — optional stand-ins for values that always exist on the row
export interface RoomUser {
	id?: number
	display_name?: string
	avatar_url?: string
	team?: Team | null
	total_amount?: number
}
```

### How to decide, field by field

1. Does the backend response / row **always include** the key?
   * No, it is omitted in some shapes (partial payload, event-specific fields) →
     keep `?`.
   * Yes → go to 2.
2. Can the value be `null` (nullable DB column, or a computed value that can be
   absent)?
   * Yes → required nullable: `field: T | null`.
   * No (NOT NULL, always set) → required: `field: T`.

Legitimate `?` examples in the codebase:

* Optional React props — `frontend/src/components/ConfirmProvider/types.ts`.
* Partial/patch request bodies — `backend/src/types/room.type.ts`
  (`CreateRoomRequest.timeLimit`, `JoinRoomRequest.team`), where the client
  sends only the keys it wants to set.

Existing well-modeled examples: `frontend/src/pages/Room/types.ts`,
`frontend/src/pages/Dashboard/types.ts`.
