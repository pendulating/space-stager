Common commands (pnpm):
- Start dev: pnpm dev
- Build: pnpm build
- Preview: pnpm preview
- Unit tests: pnpm test:unit (Vitest run with coverage)
- Lint: pnpm lint
- Format: pnpm format
- Playwright: configure tests under e2e/ (install browsers: pnpm exec playwright install --with-deps)

Other scripts:
- Vendor assets copy: node scripts/copy-vendor.mjs (pre-dev/build)
- Deploy to GH Pages: pnpm predeploy && pnpm deploy