#!/bin/bash

GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
YELLOW='\033[1;33m'
NC='\033[0m' 

echo -e "${GREEN}Starting Dropship Middleware Platform...${NC}\n"

cleanup() {
    echo -e "\n${GREEN}Shutting down servers...${NC}"
    kill $MINIO_PID
    kill $BACKEND_PID
    kill $CELERY_PID
    kill $FRONTEND_PID
    exit
}

trap cleanup SIGINT

# --- 1. START MINIO ---
echo -e "${YELLOW}[1/4] Starting MinIO Storage...${NC}"
minio server /media/foolio/beans/minio-data/ --console-address ":9001" > /dev/null 2>&1 &
MINIO_PID=$!
sleep 2

# --- 2. START BACKEND ---
echo -e "${BLUE}[2/4] Starting FastAPI backend (Port 8000)...${NC}"
cd backend
source venv/bin/activate

# Start Uvicorn in the background
uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
sleep 2

# --- 3. START CELERY WORKER ---
echo -e "${PURPLE}[3/4] Starting Celery Worker...${NC}"
# Pointing to tasks.py inside the backend folder
celery -A tasks worker --loglevel=info &
CELERY_PID=$!
cd ..

# --- 4. START FRONTEND ---
echo -e "${BLUE}[4/4] Starting Storefront UI (Port 5173)...${NC}"
cd frontend-react

# Force the script's subshell to load NVM and use Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Run Vite in the background (logs are ON)
npm run dev &
FRONTEND_PID=$!
cd ..

# --- READY ---
echo -e "\n${GREEN}All systems go!${NC}"
echo -e "-> Storefront UI:  http://localhost:5173"
echo -e "-> Backend API:    http://127.0.0.1:8000/docs"
echo -e "-> MinIO Console:  http://127.0.0.1:9001"
echo -e "\nPress Ctrl+C to stop all servers."

wait
