# React and TypeScript Guidelines

## Import Ordering

When importing multiple members from the same file:

* Sort members alphabetically
* Variables and constants first
* Functions second
* Alphabetical order inside each group

Example:

import {
  CAPTURE_SOUND_URL,
  EMPTY_BOARD_FEN,
  GAME_START_SOUND_URL,
  MOVE_SOUND_URL,

  createBoard,
  decodeFen,
  getAvailableMoves,
} from "./constants"

---

## Multi-line Imports

Use single-line imports only when there are fewer than or equal to 3 imported members.

Good:

import { BOARD_COLUMNS, BOARD_ROWS } from "./constants"

Good:

import {
  decodePayload,
  diffFenMove,
  getAvailableMoves,
  getToken
} from "./helpers"

Bad:

import { BOARD_COLUMNS, BOARD_ROWS, LS_LANGUAGE, LS_TOKEN_KEY } from "./constants"

---

## Exports

Apply the same formatting rules to:

* export
* export type
* re-export

Example:

export {
  decodePayload,
  diffFenMove,
  getAvailableMoves,
  getToken
}

---

## Object Destructuring

Apply the same grouping and sorting rules.

Rules:

* Variables first
* Functions second
* Alphabetical order inside each group

Example:

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
  openActionMenu
} = useRoomHook()

---

## General Rules

* Prefer readability over compact formatting
* Follow existing project conventions
* Prefer explicit code over clever code
* Avoid unnecessary abbreviations
* Keep formatting consistent across the project

---

## Frontend Authoring Rules

For frontend authoring-specific conventions (types/interfaces and MUI styling),
use `.github/instructions/frontend-authoring.instructions.md` as the source of
truth. This avoids rule duplication and keeps runtime agent instructions aligned
with the project docs.

---

## Expected Agent Behavior

When modifying frontend code:

* Apply these conventions automatically
* Reorganize imports when necessary
* Reorganize exports when necessary
* Reorganize destructuring when necessary
* Keep files consistent with project style
