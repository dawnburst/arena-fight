---
name: git-commit
description: Craft commit messages for the Arena Fight repo and commit them following the project's rules (conventional-commit format, mandatory DCO sign-off, branch-per-change). Use whenever the user asks for help writing a commit message, OR before you create any commit in this repo.
---

# Git Commit Helper

Guidance for committing in **this** repo. Assume you already know conventional
commits — this skill only encodes what's project-specific.

## Project rules (non-negotiable)

1. **Sign off every commit** with `-s` so the message ends with a
   `Signed-off-by: Your Name <your@email>` trailer (DCO). The name/email come
   from your git config — make sure they're set to your own identity first:
   ```bash
   git config user.name && git config user.email   # confirm your identity is set
   git commit -s -m "type(scope): description"
   ```
2. **Never commit to `main`.** Branch first: `feat/`, `fix/`, `docs/`, `chore/`,
   `ci/`, etc.
3. **Small, focused commits.** One logical change per commit; no unrelated
   refactors mixed in.
4. **Run `npm run check`** (Biome) before committing to keep formatting/lint clean.

## Message format

```
<type>(<scope>): <description>

[optional body — explain WHY, not just WHAT]

[optional footer — e.g. BREAKING CHANGE: ..., issue refs]
```

- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Subject: imperative mood, capitalized, no trailing period, ~50 chars (max 72).
- Mark breaking changes with `!` after the type/scope and a `BREAKING CHANGE:`
  footer.

## Workflow

1. **Review**: `git diff --staged` (and `git status` / `--stat` for scope).
2. **If `src/`, `index.html`, or `package.json` changed**, refresh the README
   first — use the `update-readme` skill so Features/Controls/Enemies/etc. stay
   in sync before you commit.
3. **Compose** the message: pick type + scope, write an imperative subject, add a
   body explaining why.
4. **Branch** if you're on `main`, then **commit** with sign-off:
   `git commit -s -m "type(scope): description"`.

## Amending

```bash
git commit -s --amend            # edit last message (keep sign-off)
git commit -s --amend --no-edit  # fold in staged changes, keep message
```

> Only amend commits that have **not** been pushed — amending rewrites history.

## Checklist

- [ ] Correct type + specific scope
- [ ] Imperative subject, ~50 chars (max 72), no trailing period
- [ ] Body explains WHY
- [ ] README refreshed if `src/`/`index.html`/`package.json` changed
- [ ] Breaking changes marked
- [ ] On a non-`main` branch, committed with `-s`, `npm run check` clean
