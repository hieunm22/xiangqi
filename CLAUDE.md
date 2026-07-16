# Project Instructions

Before making any changes, review and follow:

## Agent workflow
- docs/agent-workflow.md

## Localization
- docs/language-generation.md

## Type modeling (frontend + backend)
- docs/type-modeling.md (minimize optional fields; prefer required / `| null` for {frontend,backend}/src/**/*.{ts,tsx})

## Frontend coding convention
- docs/react-guidelines.md
- docs/frontend-authoring.md (MUI styling rules for frontend/src/**/*.{ts,tsx})

## New function / entry convention
- docs/new-function-convention.md (e.g. when editing frontend/src/hooks/useAPI.ts)

## Test maintenance on API change
- docs/test-maintenance.md (when editing any backend/src/routes/**/*.ts, update its colocated *.test.ts in the same change; coverage must not decrease)

## Git workflow
- Do NOT auto-commit code after refactoring, optimizations, or test fixes
- Only commit when explicitly requested by the user
- Always verify tests pass before asking user permission to commit

If a request does not match an approved workflow, follow the planning and approval process defined in docs/agent-workflow.md.
