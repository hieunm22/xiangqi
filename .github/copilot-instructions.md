# Copilot Instructions

Before making any changes, follow:

- docs/agent-workflow.md
- docs/language-generation.md
- docs/type-modeling.md (minimize optional fields for both frontend/src and backend/src; prefer required or `| null`)
- docs/react-guidelines.md
- docs/frontend-authoring.md (MUI styling)
- docs/new-function-convention.md (e.g. when editing frontend/src/hooks/useAPI.ts)
- docs/test-maintenance.md (when editing any backend/src/routes/**/*.ts, update its colocated *.test.ts in the same change; coverage must not decrease)

## Git workflow
- Do NOT auto-commit code after refactoring, optimizations, or test fixes
- Only commit when explicitly requested by the user
- Always verify tests pass before asking user permission to commit
