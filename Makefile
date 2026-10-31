.PHONY: setup run-backend run-frontend seed test

setup:
	cd backend && python -m venv venv && ./venv/Scripts/pip install -r requirements.txt
	cd frontend && npm install

run-backend:
	cd backend && ./venv/Scripts/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

run-frontend:
	cd frontend && npm run dev

seed:
	cd backend && ./venv/Scripts/python -c "from app.db import SessionLocal; from app.seed import seed_database; db = SessionLocal(); seed_database(db); db.close()"

test:
	cd backend && ./venv/Scripts/python ../scripts/smoke_test.py

