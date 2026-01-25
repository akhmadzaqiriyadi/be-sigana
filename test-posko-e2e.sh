#!/bin/bash

# Configuration
BASE_URL="http://localhost:8080/api/v1"
ADMIN_EMAIL="admin@sigana.id"
ADMIN_PASSWORD="admin123"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 Starting Posko End-to-End Test..."

# Helper function to extract JSON value
get_json_value() {
    echo $1 | python3 -c "import sys, json; print(json.load(sys.stdin)$2)" 2>/dev/null
}

# 1. Login
echo -e "\n${GREEN}1. Logging in as Admin...${NC}"
LOGIN_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\", \"password\":\"$ADMIN_PASSWORD\"}")

# Try to check if login successful
SUCCESS=$(echo $LOGIN_RES | grep "true")
if [ -z "$SUCCESS" ]; then
    echo -e "${RED}Login failed!${NC}"
    echo $LOGIN_RES
    exit 1
fi

TOKEN=$(get_json_value "$LOGIN_RES" "['data']['token']")
echo "Token acquired."

# 2. List Poskos (Initial)
echo -e "\n${GREEN}2. Listing all poskos (Initial)...${NC}"
curl -s -X GET "$BASE_URL/poskos" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 3. Create Posko
echo -e "\n${GREEN}3. Creating new posko...${NC}"
CREATE_RES=$(curl -s -X POST "$BASE_URL/poskos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Posko E2E Test Integration",
    "villageId": 1,
    "latitude": -6.1234,
    "longitude": 106.1234
  }')

echo $CREATE_RES | python3 -m json.tool

POSKO_ID=$(get_json_value "$CREATE_RES" "['data']['id']")
if [ -z "$POSKO_ID" ] || [ "$POSKO_ID" == "None" ]; then
    echo -e "${RED}Creation failed!${NC}"
    exit 1
fi
echo -e "Created Posko ID: ${GREEN}$POSKO_ID${NC}"

# 4. Get Detail
echo -e "\n${GREEN}4. Getting detailed info for ID $POSKO_ID...${NC}"
curl -s -X GET "$BASE_URL/poskos/$POSKO_ID" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 5. Filter by Village
echo -e "\n${GREEN}5. Filtering Poskos by Village ID 1...${NC}"
curl -s -X GET "$BASE_URL/poskos?villageId=1" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 6. Pagination Test
echo -e "\n${GREEN}6. Testing Pagination (Page 1, Limit 1)...${NC}"
curl -s -X GET "$BASE_URL/poskos?page=1&limit=1" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 7. Map Data
echo -e "\n${GREEN}7. getting Map Data...${NC}"
curl -s -X GET "$BASE_URL/poskos/map" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 8. Search Posko (New Feature)
echo -e "\n${GREEN}8. Searching for 'E2E Test'...${NC}"
curl -s -X GET "$BASE_URL/poskos?search=E2E%20Test" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 9. Update Posko
echo -e "\n${GREEN}9. Updating Posko...${NC}"
UPDATE_RES=$(curl -s -X PUT "$BASE_URL/poskos/$POSKO_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Posko E2E Test Integration UPDATED",
    "villageId": 1
  }')
echo $UPDATE_RES | python3 -m json.tool

# 10. Delete Posko
echo -e "\n${GREEN}10. Deleting Posko...${NC}"
curl -s -X DELETE "$BASE_URL/poskos/$POSKO_ID" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# 11. Verify Delete
echo -e "\n${GREEN}11. Verifying Delete (Should be 404/Error)...${NC}"
curl -s -X GET "$BASE_URL/poskos/$POSKO_ID" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo -e "\n${GREEN}Test Completed.${NC}"
