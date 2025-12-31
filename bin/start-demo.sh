#!/bin/bash

echo "🎨 Starting HSV Color Wheel Demo Server"
echo "======================================"

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "📡 Starting server on http://localhost:8000"
    echo "Press Ctrl+C to stop"
    cd frontend && python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "📡 Starting server on http://localhost:8000"
    echo "Press Ctrl+C to stop"
    cd frontend && python -m SimpleHTTPServer 8000
else
    echo "❌ Python not found. Please install Python or use another web server."
    echo "Alternatively, open frontend/index.html directly in your browser."
fi
