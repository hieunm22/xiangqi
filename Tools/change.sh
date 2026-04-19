#!/bin/bash

# get list of modified, staged, and untracked files
modified_files=$(git diff --name-only)
staged_files=$(git diff --name-only --cached)
untracked_files=$(git ls-files --others --exclude-standard)

# combine all into a unique list
all_files=$(echo -e "$modified_files\n$staged_files\n$untracked_files" | sort | uniq)

# required destination path
read -p "Enter destination path: " destination
# create folder if not exist
mkdir -p "$destination"

# copy each file to the correct directory structure
echo "$all_files" | while read file; do
  if [ -f "$file" ]; then
      cp --parents "$file" "$destination"
  fi
done

echo "✅ Copied changed files to '$destination' according to the correct directory structure."
