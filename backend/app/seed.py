import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import User, Document, Event, Court, Match, Booking, Notification
from app.security import get_password_hash

logger = logging.getLogger(__name__)

DEFAULT_PASSWORD = "Passw0rd!"


def seed_database(db: Session):
    pwd_hash = get_password_hash(DEFAULT_PASSWORD)

    # 1. Seed or retrieve Organizer
    organizer = db.query(User).filter(User.email == "organizer@demo.com").first()
    if not organizer:
        logger.info("Seeding base users...")
        # athlete@demo.com (age 22, has verified ID only)
        athlete1 = User(
            name="Alex Hunter",
            email="athlete@demo.com",
            password_hash=pwd_hash,
            role="athlete",
            profile_metrics={"height": 182, "weight": 76, "age": 22, "fitness_score": 88},
            device_token="fcm_token_alex_demo_12345"
        )

        # athlete2@demo.com (all docs verified)
        athlete2 = User(
            name="Sarah Connor",
            email="athlete2@demo.com",
            password_hash=pwd_hash,
            role="athlete",
            profile_metrics={"height": 168, "weight": 58, "age": 26, "fitness_score": 94},
            device_token="fcm_token_sarah_demo_67890"
        )

        organizer = User(
            name="Marcus Vance",
            email="organizer@demo.com",
            password_hash=pwd_hash,
            role="organizer",
            profile_metrics={"age": 35}
        )

        referee = User(
            name="David Webb",
            email="referee@demo.com",
            password_hash=pwd_hash,
            role="referee",
            profile_metrics={"age": 40}
        )

        db.add_all([athlete1, athlete2, organizer, referee])
        db.commit()
        db.refresh(athlete1)
        db.refresh(athlete2)
        db.refresh(organizer)

        # 2. Seed Documents
        doc1 = Document(
            user_id=athlete1.id,
            doc_type="ID",
            storage_url="/uploads/mock_athlete1_id.pdf",
            is_verified=True
        )
        doc2_id = Document(
            user_id=athlete2.id,
            doc_type="ID",
            storage_url="/uploads/mock_athlete2_id.pdf",
            is_verified=True
        )
        doc2_med = Document(
            user_id=athlete2.id,
            doc_type="MEDICAL",
            storage_url="/uploads/mock_athlete2_medical.pdf",
            is_verified=True
        )
        doc2_waiver = Document(
            user_id=athlete2.id,
            doc_type="WAIVER",
            storage_url="/uploads/mock_athlete2_waiver.pdf",
            is_verified=True
        )
        db.add_all([doc1, doc2_id, doc2_med, doc2_waiver])

        # Base courts
        base_courts = [
            Court(name="Center Court 1", sport_name="Tennis", venue="Olympic Arena", hourly_price=80000),
            Court(name="Court 2 (Hard)", sport_name="Tennis", venue="Olympic Arena", hourly_price=70000),
            Court(name="Grand Badminton Court A", sport_name="Badminton", venue="Metro Badminton Complex", hourly_price=45000),
            Court(name="Football Turf Pitch 1", sport_name="Football", venue="City Greenfields Arena", hourly_price=120000),
            Court(name="Basketball Arena Main", sport_name="Basketball", venue="Downtown Sports Center", hourly_price=60000),
        ]
        db.add_all(base_courts)
        db.commit()

        # Welcome notification
        notif = Notification(
            user_id=athlete1.id,
            title="Welcome to Sports Hub!",
            body="Discover Olympic competitions, upload your vault documents, and book courts with 1-click.",
            kind="SYSTEM",
            read=False
        )
        db.add(notif)
        db.commit()

    # 3. Seed Base Tournaments if missing
    now = datetime.now(timezone.utc)
    ev_badminton = db.query(Event).filter(Event.title == "Premier Badminton Championship 2026").first()
    if not ev_badminton:
        ev1 = Event(
            sport_name="Badminton",
            title="Premier Badminton Championship 2026",
            venue="Metro Badminton Complex",
            organizer_id=organizer.id,
            date_time=now + timedelta(days=7),
            entry_fee=50000,
            capacity=32,
            mandatory_requirements=["MIN_AGE:18", "MEDICAL", "ID"]
        )
        ev2 = Event(
            sport_name="Football",
            title="City Summer Football Cup",
            venue="City Greenfields Arena",
            organizer_id=organizer.id,
            date_time=now + timedelta(days=10),
            entry_fee=100000,
            capacity=16,
            mandatory_requirements=["MIN_AGE:16", "MEDICAL", "WAIVER"]
        )
        ev3 = Event(
            sport_name="Tennis",
            title="Metro Tennis Open 2026",
            venue="Olympic Arena",
            organizer_id=organizer.id,
            date_time=now + timedelta(days=14),
            entry_fee=75000,
            capacity=64,
            mandatory_requirements=["ID"]
        )
        ev4 = Event(
            sport_name="Basketball",
            title="Youth Basketball Challenge",
            venue="Downtown Sports Center",
            organizer_id=organizer.id,
            date_time=now + timedelta(days=5),
            entry_fee=0,
            capacity=24,
            mandatory_requirements=["MIN_AGE:14", "WAIVER"]
        )
        db.add_all([ev1, ev2, ev3, ev4])
        db.commit()

    # 4. Seed Olympic Games Competitions & Extra Sports
    logger.info("Checking and seeding Olympic Games competitions & courts...")
    olympic_events_data = [
        {
            "title": "Olympic Games 2026 Multi-Sport Invitational",
            "sport_name": "Olympic Multi-Sport",
            "venue": "Olympic Stadium Complex",
            "date_time": now + timedelta(days=30),
            "entry_fee": 150000,  # Rs. 1500
            "capacity": 128,
            "mandatory_requirements": ["MIN_AGE:18", "MEDICAL", "ID", "WAIVER"],
        },
        {
            "title": "Olympic 100m & 400m Track & Field Championship",
            "sport_name": "Athletics",
            "venue": "Olympic Grand Stadium",
            "date_time": now + timedelta(days=22),
            "entry_fee": 35000,  # Rs. 350
            "capacity": 48,
            "mandatory_requirements": ["MIN_AGE:16", "ID", "MEDICAL"],
        },
        {
            "title": "Olympic Aquatics 100m Freestyle & Medley",
            "sport_name": "Swimming",
            "venue": "Olympic Aquatics Center",
            "date_time": now + timedelta(days=18),
            "entry_fee": 45000,
            "capacity": 40,
            "mandatory_requirements": ["MIN_AGE:14", "MEDICAL"],
        },
        {
            "title": "Olympic Recurve Archery Gold Target Series",
            "sport_name": "Archery",
            "venue": "Olympic Target Grounds",
            "date_time": now + timedelta(days=25),
            "entry_fee": 60000,
            "capacity": 32,
            "mandatory_requirements": ["MIN_AGE:16", "ID", "WAIVER"],
        },
        {
            "title": "Olympic Table Tennis Grand Prix",
            "sport_name": "Table Tennis",
            "venue": "Olympic Indoor Arena",
            "date_time": now + timedelta(days=15),
            "entry_fee": 40000,
            "capacity": 32,
            "mandatory_requirements": ["ID"],
        },
        {
            "title": "Olympic Boxing Welterweight Championship",
            "sport_name": "Boxing",
            "venue": "Olympic Ring Pavilion",
            "date_time": now + timedelta(days=28),
            "entry_fee": 85000,
            "capacity": 16,
            "mandatory_requirements": ["MIN_AGE:18", "MEDICAL", "WAIVER"],
        },
    ]

    for o_ev in olympic_events_data:
        exists = db.query(Event).filter(Event.title == o_ev["title"]).first()
        if not exists:
            new_ev = Event(
                title=o_ev["title"],
                sport_name=o_ev["sport_name"],
                venue=o_ev["venue"],
                organizer_id=organizer.id,
                date_time=o_ev["date_time"],
                entry_fee=o_ev["entry_fee"],
                capacity=o_ev["capacity"],
                mandatory_requirements=o_ev["mandatory_requirements"],
            )
            db.add(new_ev)

    # 5. Seed Olympic Courts / Facilities
    olympic_courts_data = [
        {"name": "Olympic Aquatics Center - Pool 1", "sport_name": "Swimming", "venue": "Olympic Aquatics Center", "hourly_price": 95000},
        {"name": "Olympic Grand Stadium - Sprint Track", "sport_name": "Athletics", "venue": "Olympic Grand Stadium", "hourly_price": 80000},
        {"name": "Olympic Target Grounds - Range A", "sport_name": "Archery", "venue": "Olympic Target Grounds", "hourly_price": 55000},
        {"name": "Olympic Arena - Center Table 1", "sport_name": "Table Tennis", "venue": "Olympic Indoor Arena", "hourly_price": 40000},
        {"name": "Olympic Ring Pavilion - Ring A", "sport_name": "Boxing", "venue": "Olympic Ring Pavilion", "hourly_price": 70000},
    ]

    for o_court in olympic_courts_data:
        exists = db.query(Court).filter(Court.name == o_court["name"]).first()
        if not exists:
            db.add(Court(
                name=o_court["name"],
                sport_name=o_court["sport_name"],
                venue=o_court["venue"],
                hourly_price=o_court["hourly_price"]
            ))

    db.commit()

    # 6. Seed Olympic Live Matches
    tt_event = db.query(Event).filter(Event.sport_name == "Table Tennis").first()
    if tt_event:
        existing_tt_match = db.query(Match).filter(Match.tournament_id == tt_event.id).first()
        if not existing_tt_match:
            m_tt = Match(
                tournament_id=tt_event.id,
                team_a="Tokyo Spinners",
                team_b="Paris Smashers",
                court_number=1,
                start_time=now - timedelta(minutes=15),
                score_a=11,
                score_b=9,
                status="LIVE"
            )
            db.add(m_tt)

    archery_event = db.query(Event).filter(Event.sport_name == "Archery").first()
    if archery_event:
        existing_arch_match = db.query(Match).filter(Match.tournament_id == archery_event.id).first()
        if not existing_arch_match:
            m_arch = Match(
                tournament_id=archery_event.id,
                team_a="Apex Archers",
                team_b="Bullseye Elite",
                court_number=1,
                start_time=now - timedelta(minutes=45),
                score_a=29,
                score_b=28,
                status="FINISHED"
            )
            db.add(m_arch)

    boxing_event = db.query(Event).filter(Event.sport_name == "Boxing").first()
    if boxing_event:
        existing_box_match = db.query(Match).filter(Match.tournament_id == boxing_event.id).first()
        if not existing_box_match:
            m_box = Match(
                tournament_id=boxing_event.id,
                team_a="Red Corner Thunder",
                team_b="Blue Corner Blitz",
                court_number=1,
                start_time=now - timedelta(minutes=10),
                score_a=29,
                score_b=28,
                status="LIVE"
            )
            db.add(m_box)

    db.commit()
    logger.info("Olympic Games competitions & sports successfully seeded.")
