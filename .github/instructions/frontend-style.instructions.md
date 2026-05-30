## applyTo: "**/*.{ts,tsx}"

# Frontend Style Rules

## Import ordering

When importing multiple members from the same file:

* Sort all imported members alphabetically
* Separate variables/constants and functions into different groups
* Variables/constants must be placed first
* Functions must be placed below variables/constants
* Each group must be sorted alphabetically

Example:

```ts
import {
  CAPTURE_SOUND_URL,
  EMPTY_BOARD_FEN,
  GAME_START_SOUND_URL,
  MOVE_SOUND_URL,

  createBoard,
  decodeFen,
  getAvailableMoves
} from "./constant"
```

---

## Multi-line import/export formatting

If an import/export contains 3 or more members (>= 3):

* Use multi-line formatting
* One member per line
* Trailing comma is preferred

Bad:

```ts
import { decodePayload, diffFenMove, getAvailableMoves } from "common/helper"
```

Good:

```ts
import {
  decodePayload,
  diffFenMove,
  getAvailableMoves,
} from "common/helper"
```

If fewer than 3 members:

```ts
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
```

Apply the same formatting rules to:

* export statements
* re-export statements

---

## Object destructuring

Apply the same grouping and sorting rules to object destructuring.

Rules:

* Variables first
* Functions below variables
* Alphabetical sorting inside each group
* Separate groups with an empty line

Example:

```ts
const {
  actionMenuItems,
  availableMoves,
  board,
  selected,
  topSideUser,

  closeActionMenu,
  handleMenuItemClick,
  markerClass,
  onAnimateEnd,
  onPieceClick,
  openActionMenu,
} = useRoomHook()
```

---

## General formatting

* Prefer consistent formatting over compact formatting
* Avoid single-line imports/exports/destructuring when readability decreases
* Preserve existing project conventions
* Prefer explicitness and readability
