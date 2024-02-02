#!/bin/bash

# Destination of the zip file
zip_file="review.zip"

rm "$zip_file"

# Read .zipignore patterns into an array
readarray -t ignore_patterns < .zipignore

# echo "$ignore_patterns"

# Function to check if a file or directory should be ignored
is_ignored() {
    for pattern in "${ignore_patterns[@]}"; do
        # echo "$pattern"
        if [[ "$1" == "$pattern" ]]; then
            return 0
        fi
    done
    return 1
}

# Exporting function to be available in subshell for find
export -f is_ignored

# List files and directories in the root, filter out ignored ones
files_to_zip=()
for item in *; do
    if ! is_ignored "$item"; then
        files_to_zip+=("$item")
    fi
done

# Zip the filtered files and directories recursively
zip -r "$zip_file" "${files_to_zip[@]}"

echo "Created zip file: $zip_file"
