import itertools
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from ortools.sat.python import cp_model


class TournamentScheduler:
    def __init__(
        self,
        teams: List[str],
        courts_count: int,
        match_duration_mins: int = 45,
        start_time: Optional[datetime] = None,
        min_rest_slots: int = 1,
        format_type: str = "round_robin"
    ):
        self.teams = [t.strip() for t in teams if t.strip()]
        self.courts_count = courts_count
        self.match_duration_mins = match_duration_mins
        self.start_time = start_time or datetime.now()
        self.min_rest_slots = min_rest_slots
        self.format_type = format_type

    def _generate_matchups(self) -> List[tuple[str, str]]:
        if self.format_type == "single_elimination":
            # First round knockout matchups
            matchups = []
            for i in range(0, len(self.teams) - 1, 2):
                matchups.append((self.teams[i], self.teams[i + 1]))
            return matchups
        else:
            # Round Robin: every team plays every other team
            return list(itertools.combinations(self.teams, 2))

    def solve(self) -> Dict[str, Any]:
        matchups = self._generate_matchups()
        num_matches = len(matchups)
        if num_matches == 0:
            raise ValueError("No matchups could be generated. At least 2 teams required.")

        model = cp_model.CpModel()

        # Upper bound on slots needed
        # In worst case, matches are scheduled sequentially with rest
        max_slots = max(num_matches * (self.min_rest_slots + 1) + 2, 30)

        # Variables
        slot_vars = [model.NewIntVar(0, max_slots - 1, f"slot_{m}") for m in range(num_matches)]
        court_vars = [model.NewIntVar(1, self.courts_count, f"court_{m}") for m in range(num_matches)]
        court_slot_vars = [model.NewIntVar(0, max_slots * self.courts_count - 1, f"court_slot_{m}") for m in range(num_matches)]

        # 1. Unique court-slot mapping: no two matches on the same court in the same slot
        for m in range(num_matches):
            model.Add(court_slot_vars[m] == slot_vars[m] * self.courts_count + (court_vars[m] - 1))
        model.AddAllDifferent(court_slot_vars)

        # 2. Team conflict & Rest constraint
        # A team cannot play in overlapping/adjacent slots within min_rest_slots
        min_distance = self.min_rest_slots + 1
        for team in self.teams:
            # Matches involving this team
            team_matches = [m for m, (t1, t2) in enumerate(matchups) if t1 == team or t2 == team]
            for i in range(len(team_matches)):
                for j in range(i + 1, len(team_matches)):
                    m1 = team_matches[i]
                    m2 = team_matches[j]
                    # |slot[m1] - slot[m2]| >= min_distance
                    b = model.NewBoolVar(f"order_{m1}_{m2}")
                    model.Add(slot_vars[m1] - slot_vars[m2] >= min_distance).OnlyEnforceIf(b)
                    model.Add(slot_vars[m2] - slot_vars[m1] >= min_distance).OnlyEnforceIf(b.Not())

        # 3. Objective: Minimize makespan, then minimize match start slots
        makespan = model.NewIntVar(0, max_slots, "makespan")
        for m in range(num_matches):
            model.Add(makespan >= slot_vars[m] + 1)

        # Prioritize makespan (1000x weight) then early scheduling (sum of slots)
        model.Minimize(makespan * 1000 + sum(slot_vars))

        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10.0
        status = solver.Solve(model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            raise ValueError("Scheduling is infeasible with the specified constraints.")

        scheduled_matches = []
        for m in range(num_matches):
            slot_idx = solver.Value(slot_vars[m])
            court_num = solver.Value(court_vars[m])
            match_start = self.start_time + timedelta(minutes=slot_idx * self.match_duration_mins)
            match_end = match_start + timedelta(minutes=self.match_duration_mins)

            scheduled_matches.append({
                "match_index": m + 1,
                "team_a": matchups[m][0],
                "team_b": matchups[m][1],
                "court_number": court_num,
                "slot_index": slot_idx,
                "start_time": match_start,
                "end_time": match_end
            })

        # Sort matches by start time and court
        scheduled_matches.sort(key=lambda x: (x["slot_index"], x["court_number"]))

        total_slots = solver.Value(makespan)
        total_makespan_mins = total_slots * self.match_duration_mins

        return {
            "total_slots": total_slots,
            "makespan_minutes": total_makespan_mins,
            "matches": scheduled_matches
        }

