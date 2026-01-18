# External Integrations

**Analysis Date:** 2026-01-18

## APIs & External Services

**None detected.**

Goops is a fully client-side game with no backend dependencies:
- No API calls
- No database connections
- No authentication services
- No payment processing
- No analytics services

## Data Storage

**Databases:**
- None - all data stored client-side

**Local Storage:**
- Browser localStorage for game save data
- Implementation: `utils/storage.ts`
- Data stored:
  - Player rank
  - Total cumulative score
  - Power-up points (currency)
  - Purchased upgrades
  - Game settings (volume, controls)

**File Storage:**
- None - no file uploads or cloud storage

**Caching:**
- None required - all game assets bundled with build

## Authentication & Identity

**Auth Provider:**
- None - single-player game with no accounts

**Session Management:**
- None - stateless (localStorage only)

## Monitoring & Observability

**Error Tracking:**
- None configured

**Analytics:**
- None configured

**Logs:**
- Browser console only (development)

## CI/CD & Deployment

**Hosting:**
- Static file hosting (any web server)
- No specific platform configured
- Build output: `dist/` directory

**CI Pipeline:**
- Husky pre-commit hooks run tests locally
- No CI/CD service configured (GitHub Actions, etc.)

**Build Process:**
```bash
npm run build    # TypeScript compile + Vite bundle
```

## Environment Configuration

**Development:**
- No environment variables required
- All config in `constants.ts`
- Run: `npm run dev -- --host`

**Production:**
- Same as development (no env-specific config)
- Static files served from `dist/`

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Future Integration Points

If integrations are added later, likely candidates:
- **Analytics**: Track gameplay metrics (session length, scores)
- **Leaderboards**: Online score submission
- **Cloud Save**: Sync progress across devices

Currently, the game is entirely self-contained.

---

*Integration audit: 2026-01-18*
*Update when adding/removing external services*
