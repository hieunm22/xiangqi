---
applyTo: "**/*.{ts,tsx}"
---

# New Function / Entry Convention

When adding a new function, constant, or related entry to a file that is already
organized into **sections**, keep each section internally ordered. A single
feature often spans several sections of the same file. Each piece must be placed
**alphabetically within its own section** — never sort across sections.

## Core rules

* Add each new piece at its alphabetical position **within its own section**.
* If a section is **grouped** (sub-blocks separated by a comment and/or blank line),
  insert into the matching group, sorted alphabetically within that group; do not
  reorder the groups themselves.
* Match the formatting, alignment, chaining style, and typing of neighboring entries.
* Apply to any similarly-structured file, not only the example below.

## Worked example: `frontend/src/hooks/useAPI.ts`

Adding one endpoint touches **four ordered sections**, each sorted alphabetically
within itself:

1. **`EP` object** — endpoint path constant, **grouped by feature** comment
   (`// auth endpoints`, `// room endpoints`, etc.) then sorted within the group.
2. **API call functions** — one alphabetical block, by function name. Match the chained
   `.auth(...).post(...).json(<callback>).catch(handleError)` style.
3. **Callback functions** — a separate alphabetical block, by callback name. Type
   `response` with the matching `APIResponse<...>` / `APIResponseEmpty` shape.
4. **Return object** — add the function name (not the callback) alphabetically.
   `authFetch` stays first, separated by a blank line.

```ts
// 1. EP object, inside the room group, alphabetical
getRoomMembers: "/room/members",

// 2. API call functions block, alphabetical
const getRoomMembers = async (token: string, roomId: number) => authFetch(`${EP.getRoomMembers}?roomId=${roomId}`)
						.auth(`Bearer ${token}`)
						.get()
						.json(getRoomMembersCallback)
						.catch(handleError)

// 3. Callback block, alphabetical
const getRoomMembersCallback = (response: APIResponse<RoomUser[]>) => {
	return response
}

// 4. Return object, alphabetical
getRoomMembers,
```

Full reference: `docs/new-function-convention.md`.
