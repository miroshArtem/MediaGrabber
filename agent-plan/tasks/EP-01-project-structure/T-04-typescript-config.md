# T-04 — Configure TypeScript

**Epic**: EP-01 (Project Setup & Infrastructure)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:05

---

## Goal

Configure TypeScript for both extension and CoApp with proper compiler options.

---

## Subtasks

- [ ] Create `extension/tsconfig.json` for browser extension
- [ ] Create `coapp/tsconfig.json` for native app
- [ ] Configure ES modules in extension tsconfig
- [ ] Configure Node.js modules in CoApp tsconfig
- [ ] Create shared `tsconfig.base.json` with common settings
- [ ] Test TypeScript compilation for both packages

---

## Extension tsconfig.json (Shared/Content Script)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## CoApp tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2020"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Tests

- [ ] `npx tsc --project extension/tsconfig.json` succeeds
- [ ] `npx tsc --project coapp/tsconfig.json` succeeds
- [ ] No TypeScript errors in either project
