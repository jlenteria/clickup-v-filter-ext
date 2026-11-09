#!/bin/zsh
set -eu

project_root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$project_root"

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  print 'Sign in to GitHub first: gh auth login --hostname github.com'
  exit 1
fi

if [[ ! -e .git ]]; then
  git init -b main
fi

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  git add -- .gitignore README.md content.js background.js manifest.json popup scripts tests 'ClickUp View Filter'
  git diff --cached --check
  git commit -m 'Initial release of ClickUp View Filter for Chrome and Safari'
fi

repo_name='clickup-v-filter-ext'
repo_description='Chrome and Safari extension to hide individual ClickUp chat messages locally, with keyboard-controlled message selection.'

if git remote get-url origin >/dev/null 2>&1; then
  existing_repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
  existing_name="${existing_repo##*/}"
  repo_owner="${existing_repo%/*}"
  case "$existing_name" in
    clickup-view-filter)
      gh repo rename "$repo_name" --repo "$existing_repo" --yes
      ;;
    "$repo_name") ;;
    *)
      print -u2 "Origin points to $existing_repo; expected clickup-view-filter or $repo_name. No remote changes made."
      exit 1
      ;;
  esac
  gh repo edit "$repo_owner/$repo_name" \
    --visibility public --accept-visibility-change-consequences \
    --description "$repo_description"
  origin_url="$(git remote get-url origin)"
  if [[ "$origin_url" == git@github.com:* || "$origin_url" == ssh://* ]]; then
    git remote set-url origin "git@github.com:$repo_owner/$repo_name.git"
  else
    git remote set-url origin "https://github.com/$repo_owner/$repo_name.git"
  fi
  git push --set-upstream origin HEAD
else
  gh repo create "$repo_name" \
    --public \
    --description "$repo_description" \
    --source . --remote origin --push
fi

gh repo view --json url --jq .url
