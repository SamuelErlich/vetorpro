#!/bin/bash

output_file="full_source_dump.txt"
rm -f "$output_file"

# Function to add file to dump
add_file() {
    local file_path="$1"
    echo "-----------------------------------" >> "$output_file"
    echo "FILE: $file_path" >> "$output_file"
    echo "-----------------------------------" >> "$output_file"
    cat "$file_path" >> "$output_file" 2>/dev/null || echo "(Unable to read file)" >> "$output_file"
    echo "" >> "$output_file"
    echo "" >> "$output_file"
}

# Main configuration files
echo "Processing configuration files..."
for file in package.json tsconfig.json vite.config.ts vitest.config.ts drizzle.config.ts tailwind.config.ts postcss.config.js components.json; do
    [ -f "$file" ] && add_file "./$file"
done

# Server files
echo "Processing server files..."
for file in server/index.ts server/routes.ts server/storage.ts server/vite.ts server/init-data.ts; do
    [ -f "$file" ] && add_file "./$file"
done

# Server routes
echo "Processing server routes..."
for file in server/routes/*.ts; do
    [ -f "$file" ] && add_file "./$file"
done

# Server services  
echo "Processing server services..."
for file in server/services/*.ts; do
    [ -f "$file" ] && add_file "./$file"
done

# Server utils
echo "Processing server utils..."
for file in server/utils/*.ts; do
    [ -f "$file" ] && add_file "./$file"
done

# Server jobs
echo "Processing server jobs..."
for file in server/jobs/*.ts; do
    [ -f "$file" ] && add_file "./$file"
done

# Server migrations
echo "Processing server migrations..."
for file in server/migrations/*.ts; do
    [ -f "$file" ] && add_file "./$file"
done

# Shared files
echo "Processing shared files..."
for file in shared/*.ts; do
    [ -f "$file" ] && add_file "./$file"
done

# Client main files
echo "Processing client main files..."
for file in client/index.html client/src/main.tsx client/src/App.tsx client/src/index.css; do
    [ -f "$file" ] && add_file "./$file"
done

# Client pages
echo "Processing client pages..."
for file in client/src/pages/*.tsx; do
    [ -f "$file" ] && add_file "./$file"
done

# Client components (excluding ui folder for now)
echo "Processing client components..."
for file in client/src/components/*.tsx; do
    [ -f "$file" ] && add_file "./$file"
done

# Client UI components
echo "Processing client UI components..."
for file in client/src/components/ui/*.tsx; do
    [ -f "$file" ] && add_file "./$file"
done

# Client hooks
echo "Processing client hooks..."
for file in client/src/hooks/*.ts client/src/hooks/*.tsx; do
    [ -f "$file" ] && add_file "./$file"
done

# Client lib
echo "Processing client lib..."
for file in client/src/lib/*.ts; do
    [ -f "$file" ] && add_file "./$file"
done

# Public files
echo "Processing public files..."
for file in client/public/*.html client/public/*.svg; do
    [ -f "$file" ] && add_file "./$file"
done

# Documentation files
echo "Processing documentation..."
for file in README.md replit.md design_guidelines.md PRODUCTION_SETUP.md SECURITY_CONFIGURATION.md MULTI_SERVICE_VERIFICATION_REPORT.md; do
    [ -f "$file" ] && add_file "./$file"
done

# Test files
echo "Processing test files..."
for file in server/tests/*.ts server/tests/*.md; do
    [ -f "$file" ] && add_file "./$file"
done

# Additional script files
echo "Processing script files..."
for file in test-pushinpay-ip.js test-security.js; do
    [ -f "$file" ] && add_file "./$file"
done

echo "Source code dump completed: $output_file"
wc -l "$output_file"
