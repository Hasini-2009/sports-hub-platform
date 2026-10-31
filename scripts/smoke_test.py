import asyncio
import io
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import websockets

BASE_URL = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/live"


async def run_smoke_test():
    print("=" * 60)
    print("STARTING SPORTS HUB FULL END-TO-END SMOKE TEST")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Health & Docs
        print("\n[Step 1] Verifying Health & Docs...")
        res = await client.get("/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        data = res.json()
        assert data["status"] == "ok"
        print(f"PASS: /health returned {data}")

        res = await client.get("/docs")
        assert res.status_code == 200, f"Swagger docs failed: {res.status_code}"
        print("PASS: /docs returned 200 OK")

        # 2. Login as seeded users
        print("\n[Step 2] Logging in as organizer and referee...")
        res = await client.post("/api/v1/auth/login", json={"email": "organizer@demo.com", "password": "Passw0rd!"})
        assert res.status_code == 200, f"Organizer login failed: {res.text}"
        organizer_token = res.json()["access_token"]
        org_headers = {"Authorization": f"Bearer {organizer_token}"}
        print("PASS: Organizer logged in successfully")

        res = await client.post("/api/v1/auth/login", json={"email": "referee@demo.com", "password": "Passw0rd!"})
        assert res.status_code == 200, f"Referee login failed: {res.text}"
        referee_token = res.json()["access_token"]
        ref_headers = {"Authorization": f"Bearer {referee_token}"}
        print("PASS: Referee logged in successfully")

        # 3. Register a fresh athlete
        print("\n[Step 3] Registering fresh athlete user...")
        rand_id = uuid.uuid4().hex[:6]
        athlete_email = f"athlete_{rand_id}@example.com"
        res = await client.post("/api/v1/auth/register", json={
            "name": f"Test Athlete {rand_id}",
            "email": athlete_email,
            "password": "Passw0rd!",
            "role": "athlete",
            "profile_metrics": {"age": 22, "height": 180, "weight": 75, "fitness_score": 85}
        })
        assert res.status_code == 201, f"Registration failed: {res.text}"
        print(f"PASS: Registered user {athlete_email}")

        res = await client.post("/api/v1/auth/login", json={"email": athlete_email, "password": "Passw0rd!"})
        assert res.status_code == 200
        athlete_token = res.json()["access_token"]
        athlete_headers = {"Authorization": f"Bearer {athlete_token}"}
        print("PASS: Athlete logged in successfully")

        # 4. Events & Eligibility Fail
        print("\n[Step 4] Checking events and verifying eligibility failure for unverified user...")
        res = await client.get("/api/v1/events")
        assert res.status_code == 200
        events = res.json()
        assert len(events) >= 6, f"Expected at least 6 events, found {len(events)}"
        # Find Badminton Championship (requires MIN_AGE:18, MEDICAL, ID)
        target_event = next((e for e in events if "Badminton Championship" in e["title"]), events[0])
        event_id = target_event["id"]
        print(f"Target Event: '{target_event['title']}' (Reqs: {target_event['mandatory_requirements']})")

        res = await client.get(f"/api/v1/events/{event_id}/eligibility", headers=athlete_headers)
        assert res.status_code == 200
        elig = res.json()
        assert elig["eligible"] is False, f"Expected ineligible, got: {elig}"
        print(f"PASS: Eligibility check correctly failed: {[c['message'] for c in elig['checks'] if not c['passed']]}")

        # Attempt to register while ineligible -> must return 422
        res = await client.post(f"/api/v1/events/{event_id}/register", headers=athlete_headers)
        assert res.status_code == 422, f"Expected 422 Unprocessable Entity, got {res.status_code}: {res.text}"
        print("PASS: Ineligible registration blocked with 422 Unprocessable Entity")

        # 5. Upload Documents and Organizer Verification
        print("\n[Step 5] Uploading documents and organizer verification...")
        # Upload ID
        fake_id_bytes = b"%PDF-1.4 Mock Government ID document bytes"
        res = await client.post(
            "/api/v1/vault/documents",
            headers=athlete_headers,
            data={"doc_type": "ID"},
            files={"file": ("national_id.pdf", io.BytesIO(fake_id_bytes), "application/pdf")}
        )
        assert res.status_code == 201
        doc_id = res.json()["id"]
        assert res.json()["is_verified"] is False
        print(f"PASS: Uploaded ID document (id: {doc_id})")

        # Upload MEDICAL
        fake_med_bytes = b"%PDF-1.4 Mock Medical Fitness Certificate"
        res = await client.post(
            "/api/v1/vault/documents",
            headers=athlete_headers,
            data={"doc_type": "MEDICAL"},
            files={"file": ("medical_cert.pdf", io.BytesIO(fake_med_bytes), "application/pdf")}
        )
        assert res.status_code == 201
        doc_med = res.json()["id"]
        assert res.json()["is_verified"] is False
        print(f"PASS: Uploaded MEDICAL document (id: {doc_med})")

        # Organizer verifies both documents
        res = await client.post(f"/api/v1/vault/documents/{doc_id}/verify", headers=org_headers)
        assert res.status_code == 200 and res.json()["is_verified"] is True
        res = await client.post(f"/api/v1/vault/documents/{doc_med}/verify", headers=org_headers)
        assert res.status_code == 200 and res.json()["is_verified"] is True
        print("PASS: Organizer successfully verified both documents")

        # 6. Eligibility Pass and Registration
        print("\n[Step 6] Verifying eligibility passes and registering for event...")
        res = await client.get(f"/api/v1/events/{event_id}/eligibility", headers=athlete_headers)
        assert res.status_code == 200
        elig = res.json()
        assert elig["eligible"] is True, f"Expected eligible, got: {elig}"
        print("PASS: Eligibility check now PASSED (all requirements satisfied)")

        res = await client.post(f"/api/v1/events/{event_id}/register", headers=athlete_headers)
        assert res.status_code == 201
        registration = res.json()
        reg_id = registration["id"]
        assert registration["status"] == "PENDING_PAYMENT"
        print(f"PASS: Event registration created (id: {reg_id}, status: {registration['status']})")

        # 7. Payment Intent & Mock Payment Complete
        print("\n[Step 7] Testing Payment Intent and Mock Payment flow...")
        res = await client.post("/api/v1/payments/create-intent", headers=athlete_headers, json={
            "purpose": "REGISTRATION",
            "ref_id": reg_id,
            "gateway": "mock"
        })
        assert res.status_code == 201
        payment_intent = res.json()
        payment_id = payment_intent["payment_id"]
        print(f"PASS: Created payment intent {payment_id} for {payment_intent['amount']} paise")

        res = await client.post(f"/api/v1/payments/mock/complete/{payment_id}", headers=athlete_headers)
        assert res.status_code == 200
        assert res.json()["status"] == "SUCCESS"
        print("PASS: Mock payment completed successfully")

        # Verify notification was dispatched
        res = await client.get("/api/v1/notifications/me", headers=athlete_headers)
        assert res.status_code == 200
        notifications = res.json()
        reg_notif = next((n for n in notifications if n["kind"] == "REGISTRATION_CONFIRMED"), None)
        assert reg_notif is not None, f"Expected REGISTRATION_CONFIRMED notification, found: {notifications}"
        print(f"PASS: Registration confirmed notification verified: '{reg_notif['title']}'")

        # 8. Court Booking and 409 Double Booking
        print("\n[Step 8] Testing Court Booking and 409 Conflict Guard...")
        res = await client.get("/api/v1/courts")
        assert res.status_code == 200
        courts = res.json()
        assert len(courts) >= 4, f"Expected at least 4 courts, found {len(courts)}"
        court_id = courts[0]["id"]

        import random
        # Choose a random future day to guarantee no slot collisions on repeated runs
        random_day_offset = random.randint(15, 90)
        random_hour = random.randint(8, 18)
        booking_time = datetime.now(timezone.utc) + timedelta(days=random_day_offset, hours=random_hour)
        # Round to hour
        slot_start = booking_time.replace(minute=0, second=0, microsecond=0)
        slot_end = slot_start + timedelta(hours=1)

        res = await client.post("/api/v1/bookings", headers=athlete_headers, json={
            "court_id": court_id,
            "slot_start": slot_start.isoformat(),
            "slot_end": slot_end.isoformat()
        })
        assert res.status_code == 201, f"Court booking failed: {res.text}"
        booking = res.json()
        booking_id = booking["id"]
        print(f"PASS: Booked court {court_id} at {slot_start.isoformat()} (id: {booking_id})")

        # Attempt duplicate booking for same slot -> MUST return 409
        res = await client.post("/api/v1/bookings", headers=athlete_headers, json={
            "court_id": court_id,
            "slot_start": slot_start.isoformat(),
            "slot_end": slot_end.isoformat()
        })
        assert res.status_code == 409, f"Expected 409 Conflict, got {res.status_code}: {res.text}"
        print(f"PASS: Double booking was rejected with 409 Conflict: {res.json()['detail']}")

        # 9. AI Tournament Scheduler & Constraint Verification
        print("\n[Step 9] Testing AI Tournament Scheduler (OR-Tools CP-SAT)...")
        schedule_req = {
            "teams": ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"],
            "courts_count": 3,
            "match_duration_mins": 45,
            "start_time": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "min_rest_slots": 1,
            "format": "round_robin"
        }
        res = await client.post("/api/v1/scheduler/generate", headers=org_headers, json=schedule_req)
        assert res.status_code == 200, f"Scheduler failed: {res.text}"
        timetable = res.json()
        matches = timetable["matches"]
        print(f"PASS: Generated timetable: {timetable['total_slots']} slots, {len(matches)} matches")

        # Verify Hard Constraints in code:
        # Constraint A: No court used by two matches in the same slot
        court_slot_seen = set()
        for m in matches:
            key = (m["slot_index"], m["court_number"])
            assert key not in court_slot_seen, f"Court conflict detected: {key}"
            court_slot_seen.add(key)
        print("PASS: Verified no court conflicts across slots")

        # Constraint B: No team plays two matches in same slot, and rest slots respected
        team_slots: dict[str, list[int]] = {}
        for m in matches:
            for team in [m["team_a"], m["team_b"]]:
                if team not in team_slots:
                    team_slots[team] = []
                team_slots[team].append(m["slot_index"])

        for team, slots in team_slots.items():
            slots_sorted = sorted(slots)
            for i in range(len(slots_sorted) - 1):
                diff = slots_sorted[i + 1] - slots_sorted[i]
                assert diff >= 2, f"Team {team} violated min rest of 1 slot: {slots_sorted}"
        print("PASS: Verified no team conflicts and min rest constraint satisfied for all teams")

        # Commit schedule to database
        res = await client.post(f"/api/v1/scheduler/generate/{event_id}/commit", headers=org_headers, json=schedule_req)
        assert res.status_code == 200
        committed_matches = res.json()
        assert len(committed_matches) == len(matches)
        print(f"PASS: Committed {len(committed_matches)} matches to tournament {event_id}")

        # 10. Injury AI Assistant Query
        print("\n[Step 10] Testing Injury AI Assistant (RAG query)...")
        res = await client.get("/api/v1/injury/health")
        assert res.status_code == 200
        health_info = res.json()
        print(f"Injury AI Health: {health_info}")

        async with client.stream("POST", "/api/v1/injury/query", json={
            "question": "What is the PEACE and LOVE protocol for acute soft-tissue injuries?",
            "sport": "Football"
        }) as response:
            assert response.status_code == 200
            accumulated_tokens = []
            final_sources = []
            async for line in response.aiter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                if "token" in chunk:
                    accumulated_tokens.append(chunk["token"])
                if chunk.get("done"):
                    final_sources = chunk.get("sources", [])

            full_answer = "".join(accumulated_tokens)
            assert len(full_answer) > 50, f"Expected non-trivial answer, got: {full_answer}"
            assert len(final_sources) > 0, f"Expected sources, got: {final_sources}"
            print(f"PASS: Injury AI responded ({len(full_answer)} chars, sources: {final_sources})")

        # 11. WebSocket Live Score Broadcast
        print("\n[Step 11] Testing Live Score WebSocket feed...")
        res = await client.get("/api/v1/live/matches")
        assert res.status_code == 200
        live_matches = res.json()
        assert len(live_matches) > 0
        target_match = live_matches[0]
        match_id = target_match["id"]

        # Connect WebSocket
        async with websockets.connect(WS_URL) as ws:
            welcome_msg = await ws.recv()
            print(f"WebSocket connected: {welcome_msg}")

            # Referee updates score
            new_score_a = target_match["score_a"] + 5
            new_score_b = target_match["score_b"] + 3
            res = await client.put(f"/api/v1/live/matches/{match_id}/score", headers=ref_headers, json={
                "score_a": new_score_a,
                "score_b": new_score_b,
                "status": "LIVE"
            })
            assert res.status_code == 200
            print(f"Referee updated match {match_id} score to {new_score_a} - {new_score_b}")

            # WebSocket client must receive broadcast message
            ws_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            ws_event = json.loads(ws_raw)
            assert ws_event.get("event") == "SCORE_UPDATE"
            assert ws_event["match"]["id"] == match_id
            assert ws_event["match"]["score_a"] == new_score_a
            assert ws_event["match"]["score_b"] == new_score_b
            print(f"PASS: WebSocket received live SCORE_UPDATE event: {ws_event['match']['team_a']} vs {ws_event['match']['team_b']} ({new_score_a}-{new_score_b})")

    print("\n" + "=" * 60)
    print("ALL 11 SMOKE TEST SUITES PASSED FLAWLESSLY!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_smoke_test())
