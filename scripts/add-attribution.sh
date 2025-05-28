#!/bin/bash

# Add Attribution Script
# Adds "Provided by Tidal <support@tidalcloud.com>" attribution to project files

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

# Function to add attribution to TypeScript/JavaScript files
add_attribution_ts_js() {
    local file="$1"
    local comment_style="$2"  # "//" or "/* */"
    
    # Check if attribution already exists
    if grep -q "$ATTRIBUTION" "$file"; then
        print_warning "Attribution already exists in $file"
        return 0
    fi
    
    # Create temporary file with attribution
    local temp_file=$(mktemp)
    
    if [[ "$comment_style" == "//" ]]; then
        echo "// $ATTRIBUTION" > "$temp_file"
        echo "" >> "$temp_file"
        cat "$file" >> "$temp_file"
    else
        echo "/* $ATTRIBUTION */" > "$temp_file"
        echo "" >> "$temp_file"
        cat "$file" >> "$temp_file"
    fi
    
    # Replace original file
    mv "$temp_file" "$file"
    print_success "Added attribution to $file"
}

# Function to add attribution to shell scripts
add_attribution_shell() {
    local file="$1"
    
    # Check if attribution already exists
    if grep -q "$ATTRIBUTION" "$file"; then
        print_warning "Attribution already exists in $file"
        return 0
    fi
    
    # Create temporary file with attribution
    local temp_file=$(mktemp)
    
    # Read first line (shebang)
    head -n 1 "$file" > "$temp_file"
    echo "" >> "$temp_file"
    echo "# $ATTRIBUTION" >> "$temp_file"
    echo "" >> "$temp_file"
    
    # Add rest of file (skip first line)
    tail -n +2 "$file" >> "$temp_file"
    
    # Replace original file
    mv "$temp_file" "$file"
    print_success "Added attribution to $file"
}

# Function to add attribution to Markdown files
add_attribution_markdown() {
    local file="$1"
    
    # Check if attribution already exists
    if grep -q "$ATTRIBUTION" "$file"; then
        print_warning "Attribution already exists in $file"
        return 0
    fi
    
    # Create temporary file with attribution
    local temp_file=$(mktemp)
    
    # Add attribution at the end of the file
    cat "$file" > "$temp_file"
    echo "" >> "$temp_file"
    echo "---" >> "$temp_file"
    echo "" >> "$temp_file"
    echo "*$ATTRIBUTION*" >> "$temp_file"
    
    # Replace original file
    mv "$temp_file" "$file"
    print_success "Added attribution to $file"
}

# Function to add attribution to JSON files
add_attribution_json() {
    local file="$1"
    
    # Check if attribution already exists
    if grep -q "$ATTRIBUTION" "$file"; then
        print_warning "Attribution already exists in $file"
        return 0
    fi
    
    # For JSON files, we'll add a comment-like field if it's package.json
    if [[ "$file" == "package.json" ]]; then
        # Use jq to add attribution field
        if command -v jq &> /dev/null; then
            local temp_file=$(mktemp)
            jq --arg attr "$ATTRIBUTION" '. + {"_attribution": $attr}' "$file" > "$temp_file"
            mv "$temp_file" "$file"
            print_success "Added attribution to $file"
        else
            print_warning "jq not available, skipping JSON attribution for $file"
        fi
    else
        print_warning "Skipping JSON file $file (not package.json)"
    fi
}

# Function to add attribution to YAML files
add_attribution_yaml() {
    local file="$1"
    
    # Check if attribution already exists
    if grep -q "$ATTRIBUTION" "$file"; then
        print_warning "Attribution already exists in $file"
        return 0
    fi
    
    # Create temporary file with attribution
    local temp_file=$(mktemp)
    
    # Add attribution as a comment at the top
    echo "# $ATTRIBUTION" > "$temp_file"
    echo "" >> "$temp_file"
    cat "$file" >> "$temp_file"
    
    # Replace original file
    mv "$temp_file" "$file"
    print_success "Added attribution to $file"
}

# Main function to process files
main() {
    print_status "Adding attribution to project files..."
    print_status "Attribution: $ATTRIBUTION"
    echo ""
    
    # Process TypeScript files
    if find . -name "*.ts" -not -path "./node_modules/*" | grep -q .; then
        print_status "Processing TypeScript files..."
        find . -name "*.ts" -not -path "./node_modules/*" | while read -r file; do
            add_attribution_ts_js "$file" "//"
        done
    fi
    
    # Process JavaScript files
    if find . -name "*.js" -not -path "./node_modules/*" | grep -q .; then
        print_status "Processing JavaScript files..."
        find . -name "*.js" -not -path "./node_modules/*" | while read -r file; do
            add_attribution_ts_js "$file" "//"
        done
    fi
    
    # Process shell scripts
    if find . -name "*.sh" -not -path "./node_modules/*" | grep -q .; then
        print_status "Processing shell script files..."
        find . -name "*.sh" -not -path "./node_modules/*" | while read -r file; do
            add_attribution_shell "$file"
        done
    fi
    
    # Process Markdown files
    if find . -name "*.md" -not -path "./node_modules/*" | grep -q .; then
        print_status "Processing Markdown files..."
        find . -name "*.md" -not -path "./node_modules/*" | while read -r file; do
            add_attribution_markdown "$file"
        done
    fi
    
    # Process package.json specifically
    if [[ -f "package.json" ]]; then
        print_status "Processing package.json..."
        add_attribution_json "package.json"
    fi
    
    # Process YAML files
    if find . -name "*.yaml" -o -name "*.yml" -not -path "./node_modules/*" | grep -q .; then
        print_status "Processing YAML files..."
        find . \( -name "*.yaml" -o -name "*.yml" \) -not -path "./node_modules/*" | while read -r file; do
            add_attribution_yaml "$file"
        done
    fi
    
    echo ""
    print_success "Attribution process completed!"
    print_status "Run './scripts/verify-attribution.sh' to verify all attributions were added correctly."
}

# Run main function
main "$@" 