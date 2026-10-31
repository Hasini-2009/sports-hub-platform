# Sports Hub Platform (MVP)

A comprehensive sports super-app where athletes, coaches, referees, and organizers discover sports events, keep a verified Document Vault (ID, medical certificate, waiver), register in one-click once eligibility requirements are met, book courts with conflict locks, pay online, receive push notifications, follow live scores via WebSockets, get AI-powered injury care & clinical guidance, and auto-generate conflict-free tournament schedules with Google OR-Tools CP-SAT.

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Frontend["Frontend (Next.js 14 App Router + Tailwind CSS)"]
        UI_DISCOVERY["/ Events Discovery"]
        UI_VAULT["/vault Document Vault"]
        UI_BOOKINGS["/bookings Court Booking Grid"]
        UI_CARE["/care Injury AI Chatbot"]
        UI_LIVE["/live Real-Time Scoreboard"]
        UI_ORG["/organizer Tournament Scheduler"]
        UI_NOTIFS["/notifications Alerts Inbox"]
    end

    subgraph Backend["Backend (FastAPI + Uvicorn)"]
        API_AUTH["/api/v1/auth & /vault"]
        API_EVENTS["/api/v1/events (Eligibility)"]
        API_BOOKINGS["/api/v1/bookings (Concurrency Lock)"]
        API_PAYMENTS["/api/v1/payments (Unified Gateway)"]
        API_NOTIFS["/api/v1/notifications (Dispatcher)"]
        API_SCHEDULER["/api/v1/scheduler (OR-Tools CP-SAT)"]
        API_INJURY["/api/v1/injury (Ollama + ChromaDB RAG)"]
        API_LIVE["/ws/live WebSocket (Native Feed)"]
    end

    subgraph Storage["Storage & External Layers"]
        DB[("PostgreSQL 15 / SQLite Fallback")]
        CACHE[("Redis 7 / In-Memory Fallback")]
        CHROMA[("ChromaDB Persistent Store")]
        OLLAMA["Ollama LLM (gemma3:1b)"]
        GW["Payment Gateways (Mock / Stripe / Razorpay / PhonePe)"]
    end

    UI_DISCOVERY --> API_EVENTS
    UI_VAULT --> API_AUTH
    UI_BOOKINGS --> API_BOOKINGS
    UI_CARE --> API_INJURY
    UI_LIVE --> API_LIVE
    UI_ORG --> API_SCHEDULER
    UI_NOTIFS --> API_NOTIFS

    API_AUTH --> DB
    API_EVENTS --> DB
    API_BOOKINGS --> CACHE
    API_BOOKINGS --> DB
    API_PAYMENTS --> GW
    API_PAYMENTS --> DB
    API_SCHEDULER --> DB
    API_INJURY --> CHROMA
    API_INJURY --> OLLAMA
    API_LIVE --> DB
```

---

## 3-Command Quick Start

### Windows (PowerShell)
```powershell
# 1. Setup Backend
cd backend; python -m venv venv; .\venv\Scripts\pip install -r requirements.txt; cd ..

# 2. Setup Frontend
cd frontend; npm install; npm run build; cd ..

# 3. Launch Platform
.\scripts\start_all.ps1
```

### macOS / Linux (Bash)
```bash
# 1. Setup Backend & Frontend
cd backend && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt && cd ..
cd frontend && npm install && npm run build && cd ..

# 2. Launch Platform
chmod +x scripts/start_all.sh && ./scripts/start_all.sh
```

- **Frontend UI**: [http://localhost:3000](http://localhost:3000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## Zero-Dependency Automatic Fallback
The platform runs immediately out of the box with **zero required external services**:
1. **Database Fallback**: If PostgreSQL is not running or `DATABASE_URL` is omitted, the app automatically boots with SQLite (`sqlite:///./sportshub.db`).
2. **Cache / Lock Fallback**: If Redis 7 is unreachable or `REDIS_URL` is omitted, an in-memory thread-safe dictionary with TTL expiration handles court locks.
3. **AI Fallback**: If Ollama is offline, `/api/v1/injury/query` streams a clearly labelled `[Retrieval-Only Knowledge Base Response]` generated directly from ChromaDB's persistent clinical corpus.
4. **Payment & Push Fallback**: Runs in `mock` mode by default (`PAYMENT_MODE=mock`, `NOTIFY_MODE=mock`). Mock payments succeed instantly with simulated webhooks and store notifications in the database.

To switch to PostgreSQL and Redis using Docker:
```bash
docker-compose up -d
```
Then set `DATABASE_URL` and `REDIS_URL` in `.env` (or copy from `.env.example`).

---

## Seed Accounts (Password: `Passw0rd!` for all)

| Account Email | Name | Role | Pre-configured State |
| :--- | :--- | :--- | :--- |
| `athlete@demo.com` | Alex Hunter | Athlete | Age 22, ID verified in vault, missing Medical/Waiver. |
| `athlete2@demo.com` | Sarah Connor | Athlete | Age 26, all docs verified (ID, Medical, Waiver). 100% eligible. |
| `organizer@demo.com` | Marcus Vance | Organizer | Event creator, document verifier, AI scheduler operator. |
| `referee@demo.com` | David Webb | Referee | Live match scorer with real-time WebSocket broadcast controls. |

*Note: The UI top navbar includes a "Demo As" switcher for instant 1-click account switching without typing passwords.*

---

## Environment Variable Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | *None (SQLite fallback)* | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`). |
| `REDIS_URL` | *None (In-memory fallback)* | Redis connection string (`redis://localhost:6379/0`). |
| `PAYMENT_MODE` | `mock` | `mock` or `live`. When `mock`, allows 1-click simulated checkout. |
| `NOTIFY_MODE` | `mock` | `mock` or `live`. When `mock`, logs pushes and stores in notifications table. |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama local endpoint. |
| `OLLAMA_MODEL` | `gemma3:1b` | Target Ollama model name. |
| `CHROMA_PERSIST_DIR` | `./chroma_db` | Persistent directory for ChromaDB clinical embeddings. |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded private vault credentials. |
| `STRIPE_API_KEY` | `""` | Stripe secret key (live mode only). |
| `STRIPE_WEBHOOK_SECRET`| `""` | Stripe webhook signing secret. |
| `RAZORPAY_KEY_ID` | `""` | Razorpay Key ID (live mode only). |
| `RAZORPAY_KEY_SECRET` | `""` | Razorpay Key Secret. |
| `PHONEPE_MERCHANT_ID` | `""` | PhonePe Merchant ID (live mode only). |
| `PHONEPE_SALT_KEY` | `""` | PhonePe API Salt Key. |
| `FCM_SERVER_KEY` | `""` | Firebase Cloud Messaging server key. |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL accessed from browser. |

---

## Enabling Ollama AI & Switching Models
1. Install [Ollama](https://ollama.com).
2. Pull the default model:
   ```bash
   ollama pull gemma3:1b
   ```
3. To switch to another model (e.g. `llama3:8b` or `mistral`):
   ```bash
   ollama pull llama3:8b
   ```
   Set `OLLAMA_MODEL=llama3:8b` in `.env` or environment variables and restart the backend.
   The health check at `GET /api/v1/injury/health` will immediately report the active model.

---

## Switching Payments & Notifications to Live Mode
1. In `.env`, set:
   ```env
   PAYMENT_MODE=live
   NOTIFY_MODE=live
   STRIPE_API_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   FCM_SERVER_KEY=AAAA...
   ```
2. The unified payment gateway will now initiate real checkout sessions with Stripe / Razorpay / PhonePe and verify cryptographic webhook signatures (`X-Razorpay-Signature`, `Stripe-Signature`, or `X-VERIFY`).
3. The push dispatcher will automatically route notifications via FCM HTTP v1 (Android/web) or APNs (iOS) based on device tokens.

---

## 2-Minute Demo Script for Judges

1. **Step 1: Discover Events & Verify Eligibility Block (0:00 - 0:30)**
   - Open [http://localhost:3000](http://localhost:3000) and click **"Demo As: Alex (Athlete)"**.
   - Open **"Premier Badminton Championship 2026"**.
   - Notice the Eligibility Checklist: Age (22) passes, Government ID passes, but **Medical Certificate fails** with an explicit message: *"Missing verified MEDICAL certificate in Document Vault."*
   - Click **"Register Now"** -> observe that registration is safely blocked with exact guidance.

2. **Step 2: Document Vault & Organizer Clearance (0:30 - 0:50)**
   - Click the prompt link to navigate to `/vault`.
   - Select **"Medical Fitness Certificate (MEDICAL)"**, pick any sample file, and click **"Upload to Vault"**. Notice it enters `Pending Verification`.
   - Switch navbar account to **"Marcus (Organizer)"** and navigate to `/organizer`.
   - Open the **"Doc Verifications"** tab -> click **"Verify & Grant Clearance"** on Alex's medical certificate.

3. **Step 3: 1-Click Registration & Mock Payment (0:50 - 1:15)**
   - Switch back to **"Alex (Athlete)"** and return to the badminton tournament page.
   - The checklist now turns **100% Green (Eligible to Register)**.
   - Click **"Register Now"** -> Checkout modal appears.
   - Click **"Simulate Successful Payment"** -> payment is recorded as `SUCCESS`, registration becomes `CONFIRMED`, and a push alert arrives in `/notifications`.

4. **Step 4: Court Booking & 409 Conflict Guard (1:15 - 1:35)**
   - Go to `/bookings`. Choose Center Court 1, select an open hourly slot, and reserve it.
   - Try booking the exact same slot in another tab -> immediate `409 Conflict` prevents double booking.

5. **Step 5: Live Scores & AI RAG Assistant (1:35 - 2:00)**
   - Go to `/live`: view the live scoreboard. As referee David updates a score, observe all connected browser windows receive the real-time score change via native WebSockets.
   - Go to `/care`: ask *"What is the PEACE & LOVE protocol for acute ankle sprains?"*. Watch the streaming response synthesize evidence from ChromaDB with safety disclaimers and source citations.
   - Go to `/organizer`: click **"Generate Conflict-Free Schedule"** to see Google OR-Tools CP-SAT solve a 6-team 3-court round-robin tournament in milliseconds.

