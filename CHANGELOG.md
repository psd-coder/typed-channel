# Changelog

## 0.10.1

- Add documentation site
- Add documentation link to README and package.json homepage

## 0.10.0

### Breaking Changes

- Output file extensions changed from `.js`/`.d.ts` to `.mjs`/`.d.mts`
- Consumers using deep imports must update paths (or use the new `exports` map), otherwise everything must work as before.

### Features

- Add `exports` field to package.json for proper subpath imports (`typed-channel/transports/eventTarget`, `typed-channel/transports/postMessage`)
- Update dependencies and tooling
