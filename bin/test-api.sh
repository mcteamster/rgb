#!/bin/bash

# Test script for RGB Game API
# Usage: ./test-api.sh <API_GATEWAY_URL>

if [ -z "$1" ]; then
    echo "Usage: ./test-api.sh <API_GATEWAY_URL>"
    echo "Example: ./test-api.sh https://abc123.execute-api.us-east-1.amazonaws.com/prod"
    exit 1
fi

API_URL=$1

echo "🧪 Testing RGB Game API"
echo "======================"
echo "API URL: $API_URL"
echo ""

# Test 1: Create a game
echo "1️⃣ Creating a new game..."
GAME_RESPONSE=$(curl -s -X POST "$API_URL/games" -H "Content-Type: application/json")
echo "Response: $GAME_RESPONSE"

# Extract gameId from response
GAME_ID=$(echo $GAME_RESPONSE | grep -o '"gameId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$GAME_ID" ]; then
    echo "✅ Game created with ID: $GAME_ID"
    echo ""
    
    # Test 2: Join the game
    echo "2️⃣ Joining game $GAME_ID..."
    JOIN_RESPONSE=$(curl -s -X POST "$API_URL/games/$GAME_ID/join" \
        -H "Content-Type: application/json" \
        -d '{"playerName":"TestPlayer"}')
    echo "Response: $JOIN_RESPONSE"
    echo "✅ Join game test completed"
else
    echo "❌ Failed to create game"
fi
