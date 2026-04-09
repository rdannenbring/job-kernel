#!/bin/bash

# Configuration
BASE_BACKEND_PORT=8000
BASE_FRONTEND_PORT=5173
BASE_DB_PORT=5432
BASE_ONLYOFFICE_PORT=8443

# Get current branch name
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)

# Sanitize branch name for Docker project name (alphanumeric only)
SAFE_BRANCH=$(echo $BRANCH_NAME | sed 's/[^a-zA-Z0-9]//g' | tr '[:upper:]' '[:lower:]')
export COMPOSE_PROJECT_NAME="jobapp-${SAFE_BRANCH:-dev}"

if [ "$BRANCH_NAME" == "main" ] || [ "$BRANCH_NAME" == "master" ]; then
    echo "⚠️  Warning: You are on $BRANCH_NAME. Using default ports might conflict with your main environment."
    OFFSET=0
else
    # Calculate a simple offset based on the branch name to avoid port collisions
    # This sums the ASCII values of the branch name characters and takes modulo 1000
    SUM=0
    for (( i=0; i<${#SAFE_BRANCH}; i++ )); do
        SUM=$((SUM + $(printf '%d' "'${SAFE_BRANCH:$i:1}")))
    done
    OFFSET=$(( (SUM % 100) + 100 )) # Offset between 100 and 200
    echo "🌿 Dev branch detected: $BRANCH_NAME (Offset: $OFFSET)"
fi

export BACKEND_PORT=$((BASE_BACKEND_PORT + OFFSET))
export FRONTEND_PORT=$((BASE_FRONTEND_PORT + OFFSET))
export DB_PORT=$((BASE_DB_PORT + OFFSET))
export ONLYOFFICE_PORT=$((BASE_ONLYOFFICE_PORT + OFFSET))
export VITE_API_URL="http://localhost:$BACKEND_PORT"

# Load OpenAI key from .env if it exists
if [ -f ./backend/.env ]; then
    # Use a subshell to avoid exporting everything from .env
    OPENAI_KEY=$(grep OPENAI_API_KEY ./backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [ ! -z "$OPENAI_KEY" ]; then
        export OPENAI_API_KEY="$OPENAI_KEY"
    fi
fi

echo "🚀 Deploying to isolated Docker environment..."
echo "📂 Project Name:    $COMPOSE_PROJECT_NAME"
echo "🏠 Frontend URL:    http://localhost:$FRONTEND_PORT"
echo "⚙️  Backend URL:     http://localhost:$BACKEND_PORT"
echo "📊 Database Port:   $DB_PORT"
echo "📝 OnlyOffice Port: $ONLYOFFICE_PORT"
echo ""

# Build and start in detached mode
docker-compose up --build -d

echo ""
echo "✅ Deployment complete!"
echo "To stop this environment, run: docker-compose -p $COMPOSE_PROJECT_NAME down"
echo "To view logs, run: docker-compose -p $COMPOSE_PROJECT_NAME logs -f"
