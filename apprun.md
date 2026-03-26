# App Run Guide

## Exact Commands To Run

### 1. Build the frontend

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/frontend
npm install
npm run build
```

### 2. Copy the built frontend into the backend static directory

```bash
rm -rf /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend/static
cp -r /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/frontend/out /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend/static
```

### 3. Create backend virtual environment and install packages

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn httpx
```

### 4. Start the backend

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend
source .venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000
```

### 5. Open the app

```text
http://127.0.0.1:8000
```

### 6. Login

```text
username: user
password: password
```

### 7. AI chat requirement

The backend reads `OPENROUTER_API_KEY` from the project root `.env` file on startup.

If you update `.env`, restart the backend.

## One-Shot Command Block

Run this section line by line:

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/frontend
npm install
npm run build
rm -rf /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend/static
cp -r /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/frontend/out /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend/static
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn httpx
python3 -m uvicorn app.main:app --reload --port 8000
```

## Verify The App

```bash
curl http://127.0.0.1:8000/api/hello
```

Expected output:

```json
{"message":"hello"}
```

## Important: Frontend Changes Only Appear After Rebuild And Recopy

This app serves the built frontend from `backend/static`.

If you do not see the latest UI changes, run:

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/frontend
npm install
npm run build
rm -rf /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend/static
cp -r /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/frontend/out /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend/static
```

Then refresh the browser at `http://127.0.0.1:8000`.

## Docker Commands

Only use these if Docker is installed.

### Start with Docker

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed
./scripts/start-linux.sh
```

### Stop with Docker

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed
./scripts/stop-linux.sh
```

## If Something Fails

### Check tools

```bash
python3 --version
node --version
npm --version
```

### Rebuild frontend and recopy static files

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/frontend
npm install
npm run build
rm -rf /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend/static
cp -r /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/frontend/out /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend/static
```

### Restart backend

```bash
cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/pm-ed/backend
source .venv/bin/activate
python3 -m uvicorn app.main:app --reload --port 8000
```
