#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${1}${2}${NC}\n"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

clear
print_color $CYAN "========================================"
print_color $CYAN "    SecureTag App - Quick Launcher"
print_color $CYAN "========================================"
echo

# Check if Node.js is installed
if ! command_exists node; then
    print_color $RED "❌ Node.js is not installed!"
    print_color $YELLOW "Please install Node.js from https://nodejs.org/"
    echo
    exit 1
fi

# Check if npm is installed
if ! command_exists npm; then
    print_color $RED "❌ npm is not installed!"
    print_color $YELLOW "Please install npm (comes with Node.js)"
    echo
    exit 1
fi

print_color $GREEN "✅ Node.js $(node --version) detected"
print_color $GREEN "✅ npm $(npm --version) detected"
echo

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    print_color $YELLOW "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        print_color $RED "❌ Failed to install dependencies!"
        exit 1
    fi
    print_color $GREEN "✅ Dependencies installed successfully!"
    echo
fi

print_color $BLUE "🚀 Starting SecureTag App..."
echo
print_color $PURPLE "📍 Server URLs:"
print_color $PURPLE "   Backend:  http://localhost:3000"
print_color $PURPLE "   Frontend: http://localhost:8080"
echo

# Get IP address for mobile testing
IP_ADDRESS=""
if command_exists ifconfig; then
    IP_ADDRESS=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
elif command_exists ip; then
    IP_ADDRESS=$(ip route get 8.8.8.8 | awk '{print $7; exit}')
fi

if [ ! -z "$IP_ADDRESS" ]; then
    print_color $CYAN "📱 Mobile Testing URL: http://$IP_ADDRESS:8080"
    echo
fi

print_color $YELLOW "🧪 Test QR Codes:"
print_color $YELLOW "   - EMP001-SECURE-2024 (John Doe - Engineering)"
print_color $YELLOW "   - EMP002-SECURE-2024 (Jane Smith - Security)"
print_color $YELLOW "   - VISITOR-TEMP-001 (Mike Johnson - Visitor)"
echo
print_color $CYAN "💡 Generate QR codes at: https://qr-code-generator.com/"
echo

print_color $BLUE "----------------------------------------"
print_color $BLUE "Starting servers..."
print_color $BLUE "----------------------------------------"

# Function to cleanup background processes
cleanup() {
    print_color $YELLOW "\n🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    print_color $GREEN "✅ Servers stopped. Goodbye!"
    exit 0
}

# Trap Ctrl+C to cleanup
trap cleanup INT

# Start backend server in background
print_color $GREEN "🔧 Starting backend server..."
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    print_color $RED "❌ Failed to start backend server!"
    exit 1
fi

print_color $GREEN "✅ Backend server started (PID: $BACKEND_PID)"

# Start frontend server in background
print_color $GREEN "🌐 Starting frontend server..."
npx http-server . -p 8080 -c-1 --cors -s &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    print_color $RED "❌ Failed to start frontend server!"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

print_color $GREEN "✅ Frontend server started (PID: $FRONTEND_PID)"
echo

# Open browser (Mac/Linux)
print_color $CYAN "🌐 Opening browser..."
if command_exists open; then
    # macOS
    open http://localhost:8080
elif command_exists xdg-open; then
    # Linux
    xdg-open http://localhost:8080
fi

echo
print_color $GREEN "✅ SecureTag App is now running!"
echo
print_color $BLUE "📋 Control Commands:"
print_color $BLUE "   - Press Ctrl+C to stop all servers"
print_color $BLUE "   - Visit http://localhost:8080 to use the app"
print_color $BLUE "   - API health check: http://localhost:3000/api/health"
echo
print_color $PURPLE "🔗 Quick Links:"
print_color $PURPLE "   - App:        http://localhost:8080"
print_color $PURPLE "   - API Docs:   http://localhost:3000/api/health"
if [ ! -z "$IP_ADDRESS" ]; then
    print_color $PURPLE "   - Mobile:     http://$IP_ADDRESS:8080"
fi
echo
print_color $YELLOW "⏳ Servers will keep running until you press Ctrl+C..."

# Wait for user to stop
wait