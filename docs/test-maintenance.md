# Test Maintenance on API Change

When you change an **API** (a backend route handler under
`backend/src/routes/**/*.ts`), you **must** update its colocated test in the same
change so the suite stays green and **coverage does not drop**.

This is an **approved workflow**: when a request clearly involves changing an API,
update the matching test directly — no separate plan or confirmation is required for
the test update itself.

---

## What counts as an "API change"

Any edit to a route handler file `backend/src/routes/<area>/<name>.ts`, including:

* Changing the request shape (body, query, params, headers, auth requirement).
* Changing the response shape, status codes, or error messages.
* Adding, removing, or reordering branches (validation, authorization, early returns).
* Adding a new route file, or deleting one.

Each route file `foo.ts` has a colocated test `foo.test.ts` in the **same folder**.

---

## Required steps

1. **Locate the paired test.** For `backend/src/routes/<area>/<name>.ts`, open
   `backend/src/routes/<area>/<name>.test.ts`.
   * If you **added** a new route file, create the matching `*.test.ts` next to it.
   * If you **deleted** a route file, delete its `*.test.ts`.

2. **Update the test to match the new behavior.** Match the existing test style:
   * `express` app built in `beforeAll`, driven with `supertest` `request(app)`.
   * `redis` and `prisma` mocked via `vi.mock(...)` with `vi.fn()` handles; reset
     between tests (config uses `clearMocks` / `restoreMocks`).
   * One `describe` per route with the HTTP verb + path; one `it` per behavior.

3. **Do not reduce coverage** (see rules below).

4. **Run the suite and make it pass:**
   ```sh
   cd backend && yarn test
   ```
   Iterate until green. Never delete or `.skip` a failing test just to make it pass —
   fix the test to assert the new correct behavior, or fix the code if the behavior
   regressed.

5. **Do not auto-commit.** Per the project git workflow, only commit when the user
   explicitly asks, and only after tests pass.

---

## Coverage must not decrease

The rule is **behavioral, enforced by the diff** — not just a percentage number:

* **Preserve every existing test case** unless the code path it covered was removed.
  If you remove a test, the corresponding branch / status code / error path must no
  longer exist in the handler.
* **Every code path keeps a test.** For each branch in the updated handler — each
  status code, each validation failure, each error message, each auth outcome — there
  must be at least one `it` that exercises it and asserts the result.
* **New branch ⇒ new test.** If your change adds a branch (new validation, new role
  check, new early return, new status code), add an `it` that hits it in the same
  change. Net branches covered must go **up or stay equal**, never down.
* **Renamed/moved logic ⇒ move the test.** Keep assertions for the behavior even when
  the code moves between files.

### Optional: measure it numerically

A coverage provider is not installed by default. To verify a number, install the
provider and run with `--coverage`:

```sh
cd backend && yarn add -D @vitest/coverage-v8
yarn test --coverage
```

When comparing, the changed file's line **and** branch coverage must be **≥** what it
was before the change.

---

## Quick checklist

Before asking to commit an API change:

- [ ] Paired `*.test.ts` updated / created / deleted to match the route change.
- [ ] Every branch, status code, and error message in the new handler has a test.
- [ ] No existing test removed unless its code path was removed.
- [ ] `cd backend && yarn test` passes.
- [ ] No commit made (wait for explicit user request).
