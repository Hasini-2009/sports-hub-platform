import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.scheduler.solver import TournamentScheduler

def main():
    print("Testing 6 teams, 3 courts, round-robin...")
    s1 = TournamentScheduler(teams=[f"Team {i}" for i in range(1, 7)], courts_count=3, min_rest_slots=1)
    res1 = s1.solve()
    print(f"Success: {res1['total_slots']} slots, {len(res1['matches'])} matches.")

    print("Testing 8 teams, 2 courts, single_elimination...")
    s2 = TournamentScheduler(teams=[f"Team {i}" for i in range(1, 9)], courts_count=2, min_rest_slots=1, format_type="single_elimination")
    res2 = s2.solve()
    print(f"Success: {res2['total_slots']} slots, {len(res2['matches'])} matches.")

    print("All solver tests passed!")

if __name__ == "__main__":
    main()

