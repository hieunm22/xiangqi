---
applyTo: "backend/src/routes/**/*.ts"
---

# Test Maintenance on API Change

When you change an API route handler under `backend/src/routes/**/*.ts`, update its colocated test **in the same change**. Keep the suite green and **do not reduce coverage**.

## Core rules

* Each route file `foo.ts` has a colocated test `foo.test.ts` in the same folder.
  Added a route ⇒ create the test. Deleted a route ⇒ delete the test.
* Update the test to match the new request/response shape, status codes, error messages, and auth. Match the existing style: `supertest` + `express` app built in `beforeAll`, `redis`/`prisma` mocked with `vi.mock` + `vi.fn()`, one `it` per behavior.
* **Coverage must not decrease.** Every branch, status code, and error message in the updated handler must have at least one test. A new branch requires a new test. Do not remove a test unless the code path it covered was removed. Never `.skip` or delete a test just to go green.
* Run `cd backend && yarn test` and make it pass before finishing.
* Do not auto-commit — only commit when the user explicitly asks, after tests pass.

Full reference: `docs/test-maintenance.md`.
