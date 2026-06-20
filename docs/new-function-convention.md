# New Function / Entry Convention

When adding a new function, constant, or related entry to a file that is already
organized into **sections**, keep each section internally ordered. A single
feature often spans several sections of the same file (e.g. a path constant, a
function, a callback, and an export). Each piece must be placed **alphabetically
within its own section** — never sort across sections.

## Core rules

* Identify the sections of the file (usually a contiguous block of similar
  declarations, sometimes introduced by a comment).
* Add each new piece at its **alphabetical position within its own section**.
* If a section is **grouped** (sub-blocks separated by a comment and/or blank
  line), insert into the matching group, sorted alphabetically **within that
  group**; do not reorder the groups themselves.
* Match the formatting, alignment, chaining style, and typing of neighboring
  entries.
* Apply the same idea to any similarly-structured file, not only the example
  below.

---

## Worked example: `frontend/src/hooks/useAPI.ts`

[useAPI.ts](../frontend/src/hooks/useAPI.ts) is the canonical case. Adding one
endpoint touches **four ordered sections**, and each entry is sorted
alphabetically within its own section:

1. **`EP` object** — endpoint path constant
2. **API call functions** — the function performing the request
3. **Callback functions** — the `...Callback` handler passed to `.json()` / `.text()`
4. **Return object** — the function name exposed from `useAPI()`

### 1. `EP` object — grouped by feature, then alphabetical

The `EP` object is split into feature groups separated by a comment and a blank
line (`// auth endpoints`, `// user endpoints`, `// room endpoints`,
`// game endpoints`, `// message endpoints`, `// tool endpoints`).

* Place the new key under the comment block for **its feature**
* Sort keys **alphabetically within that group**
* Do not sort across groups — groups keep their existing order
* If the endpoint belongs to a new feature, add a new commented group

```ts
	// room endpoints
	createRoom: "/room/create-room",
	fetchRooms: "/room/fetch-rooms",
	getRoomInfo: "/room/info",
	getRoomMembers: "/room/members",   // inserted alphabetically within the group
	joinRoom: "/room/join",
	kickRoom: "/room/kick",
	leaveRoom: "/room/leave",
	startRoom: "/room/start",
	updateRoom: "/room/update",
```

### 2. API call functions — alphabetical by function name

The block of `const <name> = (...) => ...` API calls (functions that call
`authFetch` / `requestWithCookie`) is one section sorted **alphabetically by
function name**, regardless of feature. Match the chained
`.auth(...).post(...).json(<callback>).catch(handleError)` style.

```ts
	const getRoomMembers = async (token: string, roomId: number) => authFetch(`${EP.getRoomMembers}?roomId=${roomId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getRoomMembersCallback)
							.catch(handleError)
```

### 3. Callback functions — alphabetical by callback name

The block of `const <name>Callback = (response) => ...` handlers is a separate
section sorted **alphabetically by callback name**. Type `response` with the
matching `APIResponse<...>` / `APIResponseEmpty` shape where known.

```ts
	const getRoomMembersCallback = (response: APIResponse<RoomUser[]>) => {
		return response
	}
```

### 4. Return object — alphabetical

The object returned at the end of `useAPI()` exposes the API call functions
(not the callbacks). Add the new function name **alphabetically**. `authFetch`
stays first, separated by a blank line.

```ts
	return {
		authFetch,

		createRoom,
		drawGame,
		fetchRooms,
		// ...
		getRoomById,
		getRoomMembers,   // inserted alphabetically
		getUnreadCount,
		// ...
	}
```

---

## Summary

* Each new entry is sorted alphabetically **within its own section**
* Grouped sections (like `EP`) are sorted **within the group**, groups stay put
* `useAPI.ts` has four sections: `EP` → API call functions → callbacks → return object
* Callbacks are **not** exposed in the return object
* Keep alignment, chaining style, and typing consistent with neighbors
