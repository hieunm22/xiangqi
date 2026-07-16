---
applyTo: "frontend/src/**/*.{ts,tsx}"
---

# Frontend Authoring Convention

Rules for styling MUI components. Authoring types/interfaces (minimize optional
fields) is a shared frontend + backend rule — see
`type-modeling.instructions.md`. Import/export/destructuring formatting lives in
`frontend-style.instructions.md`.

## MUI components and styling

Put styling in the component's colocated `.scss` file and apply it with
`className`. Minimize `sx`.

* Every page/component folder has a colocated stylesheet named after the folder
  (e.g. `pages/Room/Room.scss`, `components/Layout/Layout.scss`). Add styles
  there and reference them via `className`.
* Do **not** use `sx` for properties that CSS can express (spacing, layout,
  flexbox, sizing, `display`, `gap`, plain colors, etc.).
* Use `sx` **only** for values CSS cannot express, mainly MUI theme tokens and
  deep component-slot overrides:
  * theme-token values — `color: "primary.main"`, `backgroundColor: "primary.text"`, `borderColor: "primary.main"`
  * slot selectors on an MUI component — `"& .MuiDialog-paper": { ... }`
* When both are needed, combine: `className` for the CSS-expressible styles plus
  a minimal `sx` for the theme-token/slot bits.

```tsx
// Good — layout/spacing in scss via className, sx only for the theme token
<Box className="lucky-wheel-actions">
	<Divider sx={{ borderColor: "primary.main" }} />
</Box>
```

```tsx
// Bad — CSS-expressible styles crammed into sx
<Box sx={{ display: "flex", gap: 1, mt: 4, alignItems: "center", width: "100%" }}>
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
