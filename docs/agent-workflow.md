# Agent Workflow

## General Principle

Follow documented workflows whenever possible.

If a request matches a documented and approved workflow, execute the workflow immediately without asking for confirmation.

If a request does not match a documented workflow, create a plan and wait for user approval before making changes.

---

## Approved Workflows

The following workflows are pre-approved.

When a user request clearly matches one of these workflows:

* Do not create a plan
* Do not ask for confirmation
* Execute the workflow directly
* Follow the documentation exactly

Approved workflows:

### Localization

Documentation:

* docs/language-generation.md

Examples:

* Add localization for forgot password page
* Update login translations
* Add missing translation keys
* Rename localization text

---

### Frontend Code Conventions

Documentation:

* docs/react-guidelines.md

Examples:

* Sort imports
* Reorganize exports
* Reformat object destructuring
* Apply project TypeScript conventions
* Fix code style issues

---

## Planning Required

Before making changes, present a plan and wait for approval when:

* The request does not match an approved workflow
* Multiple implementation approaches exist
* Architectural decisions are required
* New patterns are introduced
* Database schema changes are required
* Significant refactoring is required
* Data loss may occur
* The impact is unclear

---

## Plan Format

When planning is required:

1. Understanding
2. Proposed approach
3. Files expected to change
4. Commands expected to run
5. Risks or tradeoffs
6. Request confirmation

Example:

Understanding:
The localization system should be migrated from Excel to a database.

Approach:

1. Create translation tables
2. Add translation APIs
3. Update frontend localization loading
4. Remove generation workflow

Files:

* backend/...
* frontend/...

Please confirm before proceeding.

---

## Exceptions

Approval is not required for:

* Reading files
* Searching code
* Inspecting project structure
* Reviewing code
* Explaining code
* Creating plans

---

## Minor Changes

Small changes may be applied immediately when all conditions are met:

- The user explicitly requests the implementation.
- The scope is limited to a single file.
- The change is low risk.
- No script execution is required.
- No architecture changes are involved.
- No generated files are involved.

Examples:

Allowed:

* Fix a typo
* Rename a variable
* Add a missing import
* Change button text

Not allowed:

* Run localization generation
* Refactor multiple modules
* Change folder structure
* Introduce new architecture
