#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' 

echo -e "${GREEN}Starting Dropship Middleware Platform...${NC}\n"

cleanup() {
    echo -e "\n${GREEN}Shutting down servers...${NC}"
    kill $BACKEND_PID
    kill $FRONTEND_PID
    kill $CELERY_PID
    exit
}

trap cleanup SIGINT

# --- START BACKEND ---
echo -e "${BLUE}[1/3] Starting FastAPI backend (Port 8000)...${NC}"
cd backend
source venv/bin/activate

# Start Uvicorn in the background
uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Give the backend a second to boot up before firing up the rest
sleep 2

# --- START CELERY WORKER ---
echo -e "${PURPLE}[2/3] Starting Celery Worker...${NC}"
celery -A dropship_tasks worker --loglevel=info &
CELERY_PID=$!
cd ..

# --- START FRONTEND ---
echo -e "${BLUE}[3/3] Starting Storefront UI (Port 5173)...${NC}"
cd frontend-react
# We pipe the output to /dev/null to keep your terminal clean, but keep it running in the background!
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!
cd ..

# --- READY ---
echo -e "\n${GREEN}All systems go!${NC}"
echo -e "-> Storefront UI:  http://localhost:5173"
echo -e "-> Backend API:    http://127.0.0.1:8000/docs"
echo -e "\nPress Ctrl+C to stop all servers."

wait
