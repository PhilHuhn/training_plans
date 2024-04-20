from typing import List, Optional
from .phase import Phase


class TrainingPlan:
    def __init__(
            self,
            phases: Optional[List[Phase]] = None,
            competitions: Optional[List[str]] = None,
    ):
        self.phases = phases
        self.competitions = competitions if competitions else []

    def __repr__(self):
        return f"TrainingPlan({self.phases}, {self.competitions})"

    def __str__(self):
        return f"Training Plan: {self.phases} {self.competitions}"

    @property
    def json(self):
        return {
            "phases": [phase.json for phase in self.phases],
            "competitions": self.competitions
        }

    def from_json(self, json_doc):
        self.phases = [Phase.from_json(phase) for phase in json_doc.get("phases", [])]
        self.competitions = json_doc.get("competitions", [])
        return self
