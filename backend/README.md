# Smart Bin Backend

## Setup
1. Create a `.env` file in the project root with `DATABASE_URL` and `SECRET_KEY`.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Initialize the database using the script in the root directory.

## Running
Start the FastAPI server:
```bash
uvicorn main:app --reload
```
The API will be available at `http://localhost:8000`.
WebSocket at `ws://localhost:8000/ws/bins`.
