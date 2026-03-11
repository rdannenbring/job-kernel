#!/bin/bash

echo "🚀 Setting up Resume Automator..."
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

# Enable forward compatibility for Python 3.14
export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1

echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please add your OpenAI API key to backend/.env"
    echo "   Edit the file and replace 'your_openai_api_key_here' with your actual key"
    echo ""
fi

cd ..

# Frontend setup
echo ""
echo "📦 Setting up frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing Node dependencies..."
    npm install
else
    echo "Node dependencies already installed"
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your OpenAI API key to backend/.env"
echo "Run ./start-local.sh to start the application!"
echo ""
