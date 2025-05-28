#!/bin/bash

# Verify Attribution Script
# Verifies that "Provided by Tidal <support@tidalcloud.com>" attribution exists in project files

set -e

# Attribution text
ATTRIBUTION="Provided by Tidal <support@tidalcloud.com>"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Counters
TOTAL_FILES=0
FILES_WITH_ATTRIBUTION=0
FILES_WITHOUT_ATTRIBUTION=0

# Arrays to track files
declare -a FILES_MISSING_ATTRIBUTION=()
declare -a FILES_WITH_ATTRIBUTION_LIST=()

# Function to check attribution in a file
check_attribution() {
    local file="$1"
    local file_type="$2"
    
    TOTAL_FILES=$((TOTAL_FILES + 1))
    
    if grep -q "$ATTRIBUTION" "$file"; then
        FILES_WITH_ATTRIBUTION=$((FILES_WITH_ATTRIBUTION + 1))
        FILES_WITH_ATTRIBUTION_LIST+=("$file")
        print_success "✓ $file ($file_type)"
    else
        FILES_WITHOUT_ATTRIBUTION=$((FILES_WITHOUT_ATTRIBUTION + 1))
        FILES_MISSING_ATTRIBUTION+=("$file")
        print_error "✗ $file ($file_type) - MISSING ATTRIBUTION"
    fi
}

# Function to display summary
display_summary() {
    echo ""
    echo "=================================================="
    print_status "ATTRIBUTION VERIFICATION SUMMARY"
    echo "=================================================="
    echo "Total files checked: $TOTAL_FILES"
    echo "Files with attribution: $FILES_WITH_ATTRIBUTION"
    echo "Files missing attribution: $FILES_WITHOUT_ATTRIBUTION"
    echo ""
    
    if [[ $FILES_WITHOUT_ATTRIBUTION -eq 0 ]]; then
        print_success "🎉 ALL FILES HAVE PROPER ATTRIBUTION!"
    else
        print_error "❌ SOME FILES ARE MISSING ATTRIBUTION"
        echo ""
        print_status "Files missing attribution:"
        for file in "${FILES_MISSING_ATTRIBUTION[@]}"; do
            echo "  - $file"
        done
        echo ""
        print_status "To add attribution to missing files, run:"
        echo "  ./scripts/add-attribution.sh"
    fi
    
    echo ""
    if [[ $FILES_WITH_ATTRIBUTION -gt 0 ]]; then
        print_status "Files with attribution:"
        for file in "${FILES_WITH_ATTRIBUTION_LIST[@]}"; do
            echo "  ✓ $file"
        done
    fi
}

# Main function
main() {
    print_status "Verifying attribution in project files..."
    print_status "Looking for: $ATTRIBUTION"
    echo ""
    
    # Check TypeScript files
    if find . -name "*.ts" -not -path "./node_modules/*" | grep -q .; then
        print_status "Checking TypeScript files..."
        find . -name "*.ts" -not -path "./node_modules/*" | while read -r file; do
            check_attribution "$file" "TypeScript"
        done
    fi
    
    # Check JavaScript files
    if find . -name "*.js" -not -path "./node_modules/*" | grep -q .; then
        print_status "Checking JavaScript files..."
        find . -name "*.js" -not -path "./node_modules/*" | while read -r file; do
            check_attribution "$file" "JavaScript"
        done
    fi
    
    # Check shell scripts
    if find . -name "*.sh" -not -path "./node_modules/*" | grep -q .; then
        print_status "Checking shell script files..."
        find . -name "*.sh" -not -path "./node_modules/*" | while read -r file; do
            check_attribution "$file" "Shell Script"
        done
    fi
    
    # Check Markdown files
    if find . -name "*.md" -not -path "./node_modules/*" | grep -q .; then
        print_status "Checking Markdown files..."
        find . -name "*.md" -not -path "./node_modules/*" | while read -r file; do
            check_attribution "$file" "Markdown"
        done
    fi
    
    # Check package.json specifically
    if [[ -f "package.json" ]]; then
        print_status "Checking package.json..."
        check_attribution "package.json" "JSON"
    fi
    
    # Check YAML files
    if find . \( -name "*.yaml" -o -name "*.yml" \) -not -path "./node_modules/*" | grep -q .; then
        print_status "Checking YAML files..."
        find . \( -name "*.yaml" -o -name "*.yml" \) -not -path "./node_modules/*" | while read -r file; do
            check_attribution "$file" "YAML"
        done
    fi
    
    # Display summary
    display_summary
    
    # Exit with appropriate code
    if [[ $FILES_WITHOUT_ATTRIBUTION -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@" 