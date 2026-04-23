#!/bin/bash

# Find git root directory
git_root=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$git_root" ]; then
  echo "❌ Error: Not inside a git repository"
  exit 1
fi

echo "📂 Git root: $git_root"

# get list of modified, staged, and untracked files from git root
modified_files=$(git -C "$git_root" diff --name-only)
staged_files=$(git -C "$git_root" diff --name-only --cached)
untracked_files=$(git -C "$git_root" ls-files --others --exclude-standard)

# combine all into a unique list
all_files=$(echo -e "$modified_files\n$staged_files\n$untracked_files" | sort | uniq)

# required destination path
read -p "Enter destination path: " destination
# create folder if not exist
mkdir -p "$destination"

# copy each file to the correct directory structure
copy_count=0
while IFS= read -r file; do
  if [ -n "$file" ] && [ -f "$git_root/$file" ]; then
    echo "Copying '$file' to '$destination'..."
    mkdir -p "$destination/$(dirname "$file")"
    cp "$git_root/$file" "$destination/$file"
    ((copy_count++))
  fi
done <<< "$all_files"

if [ $copy_count -gt 0 ]; then
  echo "✅ Copied $copy_count changed files to '$destination' according to the correct directory structure."
else
  echo "⚠️  No changed files found to copy."
fi
