#!/bin/bash

# Check if .env exists in backend, if not warn user
if [ ! -f ./backend/.env ]; then
    echo "⚠️  WARNING: ./backend/.env not found."
    echo "Please ensure you have set your OPENAI_API_KEY in ./backend/.env"
    # Create rudimentary .env from example if exists
    if [ -f ./backend/.env.example ]; then
        cp ./backend/.env.example ./backend/.env
        echo "Created .env from .env.example. Please edit it."
    fi
fi

# Load env to pass to docker-compose if needed, though docker-compose reads file or env
# We rely on docker-compose.yml reading from shell env or defining it.
# Ideally, we pass the API KEY.

echo "📦 Syncing frontend dependencies for host IDE..."
(cd ./frontend && npm install)

echo "📦 Syncing backend dependencies for host IDE..."
if [ -d "./backend/.venv" ]; then
    ./backend/.venv/bin/pip install -r ./backend/requirements.txt
else
    # Create venv if missing
    python3 -m venv ./backend/.venv
    ./backend/.venv/bin/pip install -r ./backend/requirements.txt
fi

echo "🐳 Building and starting Docker containers..."

# Check if docker needs sudo
if ! docker info > /dev/null 2>&1; then
    echo "⚠️  Docker permission denied. Trying with sudo..."
    sudo docker-compose --env-file ./backend/.env up --build -d
else
    docker-compose --env-file ./backend/.env up --build -d
fi

