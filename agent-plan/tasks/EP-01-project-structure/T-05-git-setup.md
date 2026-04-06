# T-05 — Set Up Git Repository

**Epic**: EP-01 (Project Setup & Infrastructure)
**Priority**: P1
**Status**: DN (done)
**Last updated**: 2026-04-06 23:25

---

## Goal

Initialize Git repository with proper .gitignore, initial commit, and branch strategy.

---

## Subtasks

- [ ] Initialize Git repo: `git init`
- [ ] Create `.gitignore` with proper patterns
- [ ] Create `.gitattributes` for binary files
- [ ] Create initial commit with directory structure
- [ ] Create `develop` branch for active development
- [ ] Create branch protection rules (if using remote)

---

## .gitignore Content

```
# Dependencies
node_modules/
*/node_modules/

# Build outputs
dist/
build/
*.js.map

# CoApp executables (source, not binary)
# ffmpeg/ffmpeg.exe should be in .gitignore for size
# (Users download ffmpeg separately or we include as LFS)

# OS files
.DS_Store
Thumbs.db
*.swp
*~

# IDE
.idea/
.vscode/
*.code-workspace

# Logs
*.log
npm-debug.log*

# Environment
.env
.env.local
.env.*.local

# Temporary
tmp/
temp/
*.tmp

# Test coverage
coverage/
```

---

## .gitattributes Content

```
# Auto-detect binary files
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.pdf binary

# Text files
*.md text
*.json text
*.ts text
*.js text

# Executables (if using LFS)
*.exe binary
```

---

## Tests

- [ ] `git status` shows clean working directory (only untracked files)
- [ ] `git log` shows initial commit
- [ ] `.gitignore` properly excludes `node_modules/`
