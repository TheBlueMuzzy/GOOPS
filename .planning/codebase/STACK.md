# Technology Stack

**Analysis Date:** 2026-01-18

## Languages

**Primary:**
- TypeScript 5.0 - All application code (`*.ts`, `*.tsx`)

**Secondary:**
- JavaScript - Config files only (`vite.config.ts`, `vitest.config.ts`)

## Runtime

**Environment:**
- Node.js (any recent LTS) - Development only
- Browser - Production runtime (React SPA)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 18.2 - UI framework (`package.json`)
- Vite 4.4 - Build tool and dev server (`vite.config.ts`)

**Testing:**
- Vitest 4.0.17 - Unit tests (`vitest.config.ts`, `tests/*.test.ts`)

**Build/Dev:**
- TypeScript 5.0 - Type checking (`tsconfig.json`)
- Vite - Bundling and HMR
- Husky 9.1 - Pre-commit hooks (runs tests)

**Styling:**
- Tailwind CSS 3.3 - Utility-first CSS (`tailwind.config.js`)
- PostCSS + Autoprefixer - CSS processing

## Key Dependencies

**Critical:**
- react 18.2 - UI rendering
- react-dom 18.2 - DOM rendering
- lucide-react 0.263 - Icons (used in UI components)

**Development:**
- @vitejs/plugin-react - React Fast Refresh
- @types/react, @types/react-dom - TypeScript definitions

## Configuration

**Environment:**
- No environment variables required
- All configuration in code (`constants.ts`)

**Build:**
- `tsconfig.json` - TypeScript strict mode, ES2020 target
- `vite.config.ts` - Minimal config, just React plugin
- `tailwind.config.js` - Tailwind configuration
- `postcss.config.js` - PostCSS with Tailwind and Autoprefixer

## Platform Requirements

**Development:**
- Any platform with Node.js
- No external dependencies (no database, no API)

**Production:**
- Static file hosting (any web server)
- Modern browser with ES2020 support
- Mobile-optimized (responsive design, touch controls)

---

*Stack analysis: 2026-01-18*
*Update after major dependency changes*
