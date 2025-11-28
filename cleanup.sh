#!/bin/bash

# Pre-Publication Cleanup Script
# This script removes sensitive information before publishing to npm

set -e  # Exit on error

echo "🧹 Starting pre-publication cleanup..."

# 1. Remove Development Team ID from Xcode project
echo "📝 Removing DEVELOPMENT_TEAM from project.pbxproj..."
sed -i '' 's/DEVELOPMENT_TEAM = FQ3ZFWW5MJ;/DEVELOPMENT_TEAM = "";/' \
  example/ios/IosIntentsExample.xcodeproj/project.pbxproj

# 2. Remove personal App Group from entitlements
echo "📝 Removing personal app group from entitlements..."
sed -i '' '/<string>group\.eu\.eblank\.insider<\/string>/d' \
  example/ios/IosIntentsExample/IosIntentsExample.entitlements

# 3. Verify .gitignore includes coverage/
if ! grep -q "^coverage/$" .gitignore 2>/dev/null; then
  echo "⚠️  Warning: coverage/ not in .gitignore, adding it..."
  echo "coverage/" >> .gitignore
fi

echo "✅ Automated cleanup complete!"
echo ""
echo "⚠️  Manual steps remaining:"
echo "  1. Update author email in package.json"
echo "  2. Verify GitHub repository URLs in package.json"
echo "  3. Review session summaries in .claude/ directory"
echo "  4. (Optional) Consider renaming 'likrot' namespaces to generic names"
echo ""
echo "After manual updates, run: npm run prepare && npm publish --dry-run"
