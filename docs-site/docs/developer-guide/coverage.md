---
sidebar_position: 4
title: Test Coverage
---

This project uses Vitest with V8 coverage. A human-readable coverage report is published after local runs and in CI.

- Coverage summary: see badge in README and CI artifacts
- Full HTML report (if generated locally): open /coverage/lcov-report/index.html in your browser

To regenerate locally:

```bash
pnpm test
open coverage/lcov-report/index.html
```


