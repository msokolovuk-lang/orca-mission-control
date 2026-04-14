# ORCA Branding Notes (Phase B.1)

Fork: `msokolovuk-lang/orca-mission-control`  
Upstream: `builderz-labs/mission-control` (MIT)

## Brand Source Of Truth

Primary branding constants live in `src/lib/brand.ts`.  
When upstream merges overwrite branding, re-apply values from this file first.

## Phase B.1 Changed Files

- `src/lib/brand.ts`
- `src/components/brand/Logo.tsx`
- `src/components/brand/Wordmark.tsx`
- `public/favicon.svg`
- `public/logo.svg`
- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `messages/ru.json`
- `messages/en.json`
- `package.json`
- `tailwind.config.js`
- `src/app/globals.css`
- `src/components/dashboard/sidebar.tsx`
- `src/components/layout/nav-rail.tsx`
- `src/nav-rail.tsx`

## Notes About Icons

- `public/favicon.ico` is not used in this phase.
- Layout metadata points to `public/favicon.svg` as the active favicon.
- `public/icon.svg`, `public/apple-icon.png`, and `public/og-image.png` were not present and were not added in this phase.

## Upstream Merge Workflow

1. Merge upstream normally.
2. Check `src/lib/brand.ts` values first and restore if changed.
3. Re-check `src/app/layout.tsx`, `tailwind.config.js`, and `src/app/globals.css` for metadata/font/color regressions.
4. Re-check `src/components/brand/*` plus nav/login usage to ensure the `Logo` component remains the visible brand in UI chrome.
