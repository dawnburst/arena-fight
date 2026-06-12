# Gemini CLI — Project Workflow Instructions

## Core Mandates

Follow these rules for all development tasks in this repository:

- **Branching:** Always create a new branch for every task using best practice naming conventions.
  - Features: `feat/description`
  - Bug fixes: `fix/description`
  - CI/CD: `ci/description`
  - Documentation: `docs/description`
  - Refactor: `refactor/description`
  - Never work directly on the `main` branch.
- **Logical Commits:** Break your changes into small, logical units. Do not bundle unrelated changes into a single commit.
- **Sign-off:** Every commit must include the Developer Certificate of Origin (DCO) sign-off flag. Use `git commit -s -m "..."`.

## Verification

Before finishing any code change, run:
```bash
npm run build
```
If the change is documentation-only, no build is required.
