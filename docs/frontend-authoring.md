# Frontend Authoring Convention

Full reference for the Copilot instruction
`.github/instructions/frontend-authoring.instructions.md`
(`applyTo: "frontend/src/**/*.{ts,tsx}"`). Covers how to style MUI components.

Authoring types/interfaces (minimize optional fields) is a shared frontend +
backend rule — see `docs/type-modeling.md`. Import/export/destructuring
formatting lives in `docs/react-guidelines.md`.

## MUI components: prefer the colocated stylesheet over `sx`

Styling belongs in the component's colocated `.scss` file, applied with
`className`. Keep `sx` for the few things CSS cannot express.

Rules:

* Each page/component folder has a stylesheet named after the folder — e.g.
  `frontend/src/pages/Room/Room.scss`,
  `frontend/src/components/Layout/Layout.scss`. Add styles there and reference
  them via `className`.
* Do not use `sx` for CSS-expressible properties: spacing, layout, flexbox,
  sizing, `display`, `gap`, plain color values, etc.
* Use `sx` only for values CSS cannot express:
  * MUI theme tokens — `color: "primary.main"`,
    `backgroundColor: "primary.text"`, `borderColor: "primary.main"`
  * MUI slot selectors — `"& .MuiDialog-paper": { ... }`
* When both are needed, combine `className` (CSS-expressible styles) with a
  minimal `sx` (theme tokens / slot overrides only).

```tsx
// Good
<Box className="lucky-wheel-actions">
	<Divider sx={{ borderColor: "primary.main" }} />
</Box>
```

```scss
// Room.scss
.lucky-wheel-actions {
	display: flex;
	gap: 8px;
	margin-top: 32px;
	align-items: center;
	width: 100%;
}
```

```tsx
// Bad — CSS-expressible styles crammed into sx
<Box sx={{ display: "flex", gap: 1, mt: 4, alignItems: "center", width: "100%" }}>
```
