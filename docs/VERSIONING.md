# Versioning Guide

Recall follows [Semantic Versioning 2.0.0](https://semver.org/) with additional guidelines for mindful version management.

## Version Format

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └── Bug fixes, security patches, docs
  │     └──────── New features (backward compatible)
  └────────────── Breaking changes
```

**Current Version:** See `package.json`

---

## When to Bump Versions

### PATCH (x.y.Z) - Bug Fixes & Maintenance

Bump patch for:

- Bug fixes that don't change behavior
- Security patches
- Documentation updates
- Dependency updates (non-breaking)
- Code refactoring (no API changes)
- Test additions/fixes
- Linting/formatting fixes

**Examples:**

- Fix crash when session file is corrupted
- Update vulnerable dependency
- Fix typo in error message

### MINOR (x.Y.0) - New Features

Bump minor for:

- New features that are backward compatible
- New API endpoints
- New CLI flags/options
- New UI components
- New agent parser support
- Deprecations (not removals)

**Examples:**

- Add Cursor agent support
- Add session search feature
- Add new export format
- Add keyboard shortcut

### MAJOR (X.0.0) - Breaking Changes

Bump major for:

- Breaking API changes
- Removed features
- Changed default behavior
- Database schema changes requiring migration
- Minimum Node.js version bump
- Renamed/restructured CLI commands

**Examples:**

- Remove deprecated API endpoint
- Change session file format
- Require Node 20+ (from Node 18+)

---

## Version Bump Process

### 1. Determine Version Type

Ask yourself:

- Does this break existing users? → **MAJOR**
- Does this add new functionality? → **MINOR**
- Is this a fix or maintenance? → **PATCH**

### 2. Update Version

```bash
# For patch (bug fix)
npm version patch

# For minor (new feature)
npm version minor

# For major (breaking change)
npm version major
```

This automatically:

- Updates `package.json`
- Creates a git commit
- Creates a git tag

### 3. Update CHANGELOG

Add entry to `CHANGELOG.md`:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- New feature description

### Changed

- Changed behavior description

### Fixed

- Bug fix description

### Removed

- Removed feature description
```

### 4. Push & Publish

```bash
# Push commit and tags
git push origin main --tags

# Publish to npm
npm publish
```

---

## Pre-Release Versions

For testing before official release:

```bash
# Alpha (early testing)
npm version prerelease --preid=alpha
# 2.2.0-alpha.0

# Beta (feature complete, testing)
npm version prerelease --preid=beta
# 2.2.0-beta.0

# Release candidate (final testing)
npm version prerelease --preid=rc
# 2.2.0-rc.0
```

---

## Version Discipline Guidelines

### Be Conservative

- When in doubt, use a **smaller** version bump
- Multiple small features can ship in one MINOR release
- Don't rush to bump MAJOR for convenience

### Batch Related Changes

- Group related bug fixes into one PATCH release
- Group related features into one MINOR release
- Avoid releasing multiple versions per day

### Communicate Breaking Changes

For MAJOR versions:

1. Document migration path in CHANGELOG
2. Consider deprecation period in prior MINOR version
3. Announce in README and release notes

### Version Checklist

Before any release:

- [ ] All tests pass (`npm test` in both backend and frontend)
- [ ] Build succeeds (`npm run build`)
- [ ] CHANGELOG.md updated
- [ ] No console warnings in development
- [ ] Manual smoke test of key features

---

## npm Publishing Checklist

Before `npm publish`:

1. **Verify version** - Is this the right bump type?
2. **Run tests** - `cd backend && npm test && cd ../frontend && npm test`
3. **Build** - `npm run build`
4. **Check dependencies** - All backend deps in root package.json?
5. **Update changelog** - Entry for this version?
6. **Commit** - All changes committed?
7. **Tag** - Git tag matches package.json version?

```bash
# Quick verification
npm run build && npm test
git status  # Should be clean
cat package.json | grep version
git tag -l | tail -3
```

---

## Version History Philosophy

- **v1.x** - Initial release, core functionality
- **v2.x** - Multi-agent support, enhanced features
- **v3.x** - (Future) Team/collaboration features
- **v4.x** - (Future) Enterprise features

We aim to stay in v2.x for the foreseeable future, incrementing MINOR versions for new features.

---

_Last updated: February 2026_
