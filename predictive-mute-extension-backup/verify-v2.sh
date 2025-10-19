#!/bin/bash

echo "🔍 Verifying Predictive Mute v2.0..."
echo ""

# Check files
echo "📁 Checking files..."
FILES=("semantic.js" "mute-controller.js" "ml-classifier.js" "content-v2.js" "popup-v2.html" "popup-v2.js" "manifest.json" "background.js" "styles.css")
ALL_PRESENT=true
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file MISSING"
    ALL_PRESENT=false
  fi
done

if [ "$ALL_PRESENT" = false ]; then
  echo ""
  echo "❌ Some files are missing!"
  exit 1
fi

# Validate syntax
echo ""
echo "🔍 Validating JavaScript syntax..."
node -c semantic.js && echo "✅ semantic.js syntax valid" || { echo "❌ semantic.js syntax error"; exit 1; }
node -c mute-controller.js && echo "✅ mute-controller.js syntax valid" || { echo "❌ mute-controller.js syntax error"; exit 1; }
node -c content-v2.js && echo "✅ content-v2.js syntax valid" || { echo "❌ content-v2.js syntax error"; exit 1; }
node -c popup-v2.js && echo "✅ popup-v2.js syntax valid" || { echo "❌ popup-v2.js syntax error"; exit 1; }
node -c background.js && echo "✅ background.js syntax valid" || { echo "❌ background.js syntax error"; exit 1; }

# Validate manifest
echo ""
echo "🔍 Validating manifest.json..."
python3 -c "import json; manifest = json.load(open('manifest.json')); print('✅ manifest.json valid JSON'); print(f'   Name: {manifest[\"name\"]}'); print(f'   Version: {manifest[\"version\"]}'); print(f'   Popup: {manifest[\"action\"][\"default_popup\"]}'); print(f'   Scripts: {len(manifest[\"content_scripts\"][0][\"js\"])} files')" || { echo "❌ manifest.json invalid"; exit 1; }

# Check icons
echo ""
echo "🔍 Checking icons..."
if [ -f "icons/icon16.png" ] && [ -f "icons/icon48.png" ] && [ -f "icons/icon128.png" ]; then
  echo "✅ All icon files present"
else
  echo "⚠️  Some icon files missing (extension will still work)"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ All checks passed! Ready to deploy v2.0"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Next steps:"
echo "1. Go to chrome://extensions"
echo "2. Enable 'Developer mode' (top-right toggle)"
echo "3. Click 'Load unpacked'"
echo "4. Select this directory: $(pwd)"
echo "5. Test on meet.google.com"
echo ""
echo "📚 Documentation:"
echo "   - README_V2.md       (full feature guide)"
echo "   - DEPLOYMENT_V2.md   (deployment instructions)"
echo ""
