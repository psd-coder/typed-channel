#!/bin/bash

# Check if version type is provided
if [ $# -lt 1 ]; then
  echo "Usage: $0 <patch|minor|major>"
  exit 1
fi

VERSION_TYPE=$1

# Use npm to bump the version in package.json (without git commit and tag)
npm --no-git-tag-version version $VERSION_TYPE

# Get the new version from package.json
NEW_VERSION=$(node -p "require('./package.json').version")

# Update jsr.json if it exists
if [ -f "jsr.json" ]; then
  jq ".version = \"$NEW_VERSION\"" jsr.json > jsr.json.tmp && mv jsr.json.tmp jsr.json
  prettier --write jsr.json
  echo "Updated version in jsr.json"
fi

# Stage the changes
git add package.json
if [ -f "jsr.json" ]; then
  git add jsr.json
fi

# Commit the changes
git commit -m "Bump version to: $NEW_VERSION"

# Create a tag without 'v' prefix
git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"

echo "Version bump complete. New version: $NEW_VERSION"
echo "Remember to push both the commit and the tag:"
echo "  git push origin main"
echo "  git push --tags"
