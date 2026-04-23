#!/bin/bash

if [ ! -d "venv" ]; then
  echo "📦 creating virtual environment..."
  python3 -m venv venv
fi

echo "🚀 activating virtual environment..."
source venv/bin/activate

if ! pip show openpyxl >/dev/null 2>&1; then
  echo "📚 installing openpyxl..."
  pip install --upgrade pip
  pip install openpyxl
fi

echo "running convert-to-json.py..."
python3 convert-to-json.py

echo "complete"
