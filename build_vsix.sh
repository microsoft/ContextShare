#!/bin/bash

# Cross-platform VSIX build script for macOS/Linux
# Alternative to build_vsix.ps1 when PowerShell Core is not available

set -e  # Exit on any error

# Parse command line arguments
VERSION_BUMP=""
VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --bump)
            VERSION_BUMP="$2"
            shift 2
            ;;
        --version)
            VERSION="$2" 
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--bump patch|minor|major] [--version x.y.z]"
            echo ""
            echo "Options:"
            echo "  --bump patch|minor|major  Automatically bump version before building"
            echo "  --version x.y.z           Use specific version number"
            echo "  -h, --help               Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Handle version bumping if requested
if [ -n "$VERSION_BUMP" ]; then
    if ! command -v node >/dev/null 2>&1; then
        echo "Error: Node.js is required for version bumping"
        exit 1
    fi
    
    echo "Bumping version ($VERSION_BUMP)..."
    
    # Read current version
    CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
    echo "Current version: $CURRENT_VERSION"
    
    # Calculate new version
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}  
    PATCH=${VERSION_PARTS[2]}
    
    case $VERSION_BUMP in
        major)
            MAJOR=$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
        minor)
            MINOR=$((MINOR + 1))
            PATCH=0
            ;;
        patch)
            PATCH=$((PATCH + 1))
            ;;
        *)
            echo "Error: Invalid bump type '$VERSION_BUMP'. Use: patch, minor, or major"
            exit 1
            ;;
    esac
    
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    echo "New version: $NEW_VERSION"
    
    # Update package.json
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.version = '$NEW_VERSION';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
        console.log('Updated package.json to version $NEW_VERSION');
    "
    
    VERSION="$NEW_VERSION"
fi

# Extract version from package.json if not provided
if [ -z "$VERSION" ]; then
    if command -v node >/dev/null 2>&1; then
        VERSION=$(node -e "console.log(require('./package.json').version)")
    elif command -v python3 >/dev/null 2>&1; then
        VERSION=$(python3 -c "import json; print(json.load(open('package.json'))['version'])")
    else
        echo "Error: Need Node.js or Python3 to extract version from package.json"
        exit 1
    fi
fi

echo "Building VSIX for version $VERSION"

# Build the extension
echo "Running npm build..."
npm run build

PKG_NAME="copilot-catalog-manager-$VERSION"

# Clean up any existing files
rm -f "$PKG_NAME.vsix"
rm -rf vsix_build

# Create build directory structure
mkdir -p vsix_build/extension

echo "Copying extension files..."

# Copy all files except excluded patterns
find . -type f \
    ! -path "./node_modules/*" \
    ! -path "./vsix_build/*" \
    ! -path "./.git/*" \
    ! -name "*.vsix" \
    -exec bash -c '
        rel_path="${1#./}"
        dest_dir="vsix_build/extension/$(dirname "$rel_path")"
        mkdir -p "$dest_dir"
        cp "$1" "vsix_build/extension/$rel_path"
    ' _ {} \;

# Copy VSIX manifest files
cp vsix/extension.vsixmanifest vsix_build/extension.vsixmanifest
cp "vsix/[Content_Types].xml" "vsix_build/[Content_Types].xml"
if [ -d "vsix/_rels" ]; then
    cp -r vsix/_rels vsix_build/_rels
fi

echo "Updating manifest with version info..."

# Update manifest version using sed (cross-platform)
sed -i.bak "s/Version=\"[^\"]*\"/Version=\"$VERSION\"/" vsix_build/extension.vsixmanifest

# Extract publisher and name from package.json and update manifest
if command -v node >/dev/null 2>&1; then
    PUBLISHER=$(node -e "const pkg=require('./package.json'); console.log(pkg.publisher || '')")
    PKG_NAME_JSON=$(node -e "const pkg=require('./package.json'); console.log(pkg.name || '')")
    
    if [ -n "$PUBLISHER" ]; then
        sed -i.bak "s/Publisher=\"[^\"]*\"/Publisher=\"$PUBLISHER\"/" vsix_build/extension.vsixmanifest
    fi
    
    if [ -n "$PKG_NAME_JSON" ]; then
        sed -i.bak "s/Id=\"[^\"]*\"/Id=\"$PKG_NAME_JSON\"/" vsix_build/extension.vsixmanifest
    fi
    
    # Update the packaged package.json
    if [ -f "vsix_build/extension/package.json" ]; then
        node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('vsix_build/extension/package.json', 'utf8'));
            pkg.version = '$VERSION';
            if ('$PUBLISHER') pkg.publisher = '$PUBLISHER';
            fs.writeFileSync('vsix_build/extension/package.json', JSON.stringify(pkg, null, 2));
            console.log('Updated package.json to version $VERSION');
        "
    fi
fi

# Clean up sed backup files
rm -f vsix_build/extension.vsixmanifest.bak

echo "Creating VSIX archive..."

# Change to build directory
cd vsix_build

# Create the VSIX file using zip
if command -v zip >/dev/null 2>&1; then
    zip -r -q "../$PKG_NAME.vsix" extension extension.vsixmanifest "[Content_Types].xml" $([ -d "_rels" ] && echo "_rels")
    echo "Created $PKG_NAME.vsix using zip"
else
    echo "Error: zip command not found. Please install zip utility:"
    echo "  macOS: zip should be pre-installed, or install with: brew install zip"
    echo "  Ubuntu/Debian: sudo apt-get install zip"
    echo "  CentOS/RHEL: sudo yum install zip"
    exit 1
fi

# Go back to project root
cd ..

echo "Created $PKG_NAME.vsix"
echo "Install with: code --install-extension ./$PKG_NAME.vsix"

# Copy VSIX to build folder
mkdir -p build
cp "$PKG_NAME.vsix" "build/$PKG_NAME.vsix"
echo "Copied $PKG_NAME.vsix to build folder"

# Cleanup the staging folder
rm -rf vsix_build
echo "Removed staging folder 'vsix_build'"

echo "Build complete!"
