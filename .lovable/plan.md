# Auth Pages — Sign In + Sign Up (Local Mock)

Build two routes that share one visual system, matching the reference mockup pixel-for-pixel. Mock auth — no Lovable Cloud. Users are persisted in `localStorage` so login actually works in preview for testing.

## Routes

- `/auth` → Sign In (email + password)
- `/signup` → Sign Up (full name + email + password + confirm password)
- Both routes link to each other via the top-right "Sign In / Sign Up" pill toggle.

## Layout (identical on both pages)

```text
┌─────────────────────────────────────────────────────────────┐
│ [icon] IMPERIUM intro copy        [Sign In|Sign Up]   10%   │
│                                                              │
│                                   ↓                          │
│                                   <Big Heading>              │
│                                   ( email pill input )       │
│                                   ( password pill input )    │
│                                   ( + name / confirm )       │
│                                   forgot? / accept code      │
│ - - - - - - - - - - - - - - - - - + - - - - - - - - - - -  │ ← dashed guides
│                                                              │
│        ┌──────────── device frame ────────────┐              │
│        │        VIDEO COMING SOON             │              │
│        └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

- Pure black `#000` background, off-white `#f1ece6` text, coral `#ff5a3a` accents, JetBrains-mono for micro labels, thin sans for the big heading.
- Dashed crosshair guides through the page (CSS only).
- Bottom device frame is a placeholder `<div>` with a centered "VIDEO COMING SOON" label — ready to swap for a `<video>` tag later.

## Fields & Validation (zod, client-side)

**Sign In (`/auth`)**
- `email` — required, valid email
- `password` — required, min 8

**Sign Up (`/signup`)**
- `fullName` — required, 2–60 chars, letters/spaces/`.-'`
- `email` — required, valid email, lowercased, not already registered
- `password` — required, min 8, ≥1 uppercase, ≥1 number
- `confirmPassword` — must equal `password`

Inline error text appears under each pill input. Submit button disabled until valid.

## Mock Auth Logic (local, no backend)

A tiny `mockAuth.ts` module in `src/frontend/auth/`:

- `signup({ fullName, email, password })` — hashes password with Web Crypto SHA-256, stores `{ id, fullName, email, passwordHash }` in `localStorage` under `imperium.users`. Rejects if email exists.
- `signIn({ email, password })` — looks up user, compares hash, sets `imperium.session = { userId, email, fullName }`.
- `signOut()`, `getSession()`.
- `useSession()` hook for components.

After successful sign in / sign up → `navigate({ to: "/" })` (or `/dashboard` once that page has UI — for now landing).

## Files to create / edit

**New**
- `src/frontend/auth/SignInPage.tsx`
- `src/frontend/auth/SignUpPage.tsx`
- `src/frontend/auth/components/AuthShell.tsx` — shared layout (icon + intro, toggle, heading slot, form slot, video frame)
- `src/frontend/auth/components/PillInput.tsx` — reusable pill input with red crosshair icon + optional right icon (return / eye)
- `src/frontend/auth/components/AuthToggle.tsx` — Sign In / Sign Up pill toggle
- `src/frontend/auth/components/VideoFrame.tsx` — bottom device frame placeholder
- `src/frontend/auth/mockAuth.ts` — local user store + session
- `src/frontend/auth/validation.ts` — zod schemas
- `src/frontend/auth/auth.css` — all `.auth-*` scoped styles (no Tailwind class collisions)
- `src/routes/signup.tsx` — thin route → `SignUpPage`

**Edit**
- `src/routes/auth.tsx` — point to `SignInPage` instead of placeholder
- Replace old `src/frontend/auth/AuthPage.tsx` (placeholder) — keep file as a barrel re-export of `SignInPage` to avoid breaking imports, or delete.

## What this plan does NOT do

- No Lovable Cloud / real Supabase auth (mock only, as requested).
- No video file — just the framed placeholder.
- No password reset wiring (the existing `/reset-password` route stays as the placeholder for now).
- No styling changes to landing or other pages.

## After approval

1. Build the files above.
2. Open `/auth` and `/signup` in the preview, test the full flow: sign up → land on home → log out → sign in.
3. Show you a screenshot of the live result.
