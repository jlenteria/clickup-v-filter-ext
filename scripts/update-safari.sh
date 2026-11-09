#!/bin/zsh
set -eu

project_root="$(cd -- "$(dirname -- "$0")/.." && pwd)"
resource_root="$project_root/ClickUp View Filter/ClickUp View Filter Extension/Resources"
build_root="$(mktemp -d /tmp/cvf-safari-update.XXXXXX)"

for resource in content.js background.js manifest.json README.md popup/popup.js popup/popup.html popup/popup.css; do
  cp "$project_root/$resource" "$resource_root/$resource"
done

xcodebuild \
  -project "$project_root/ClickUp View Filter/ClickUp View Filter.xcodeproj" \
  -scheme 'ClickUp View Filter' \
  -configuration Release \
  -derivedDataPath "$build_root" \
  CURRENT_PROJECT_VERSION=4 MARKETING_VERSION=0.6.0 build

built_app="$build_root/Build/Products/Release/ClickUp View Filter.app"
installed_app='/Applications/ClickUp View Filter.app'
/usr/bin/codesign --verify --deep --strict "$built_app"

if [[ -d "$installed_app" ]]; then
  /usr/bin/ditto "$installed_app" "$build_root/Previous ClickUp View Filter.app"
fi
/usr/bin/ditto "$built_app" "$installed_app"
/usr/bin/codesign --verify --deep --strict "$installed_app"
/usr/bin/open "$installed_app"

print 'Installed ClickUp View Filter 0.6.0.'
print 'Quit Safari completely (Command-Q), reopen it, and reload ClickUp.'
print 'The updated popup has a “Clear manual hides” button.'
print "Build and previous app (if any): $build_root"
