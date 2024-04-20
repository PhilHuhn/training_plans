from typing import List, Optional
import datetime as dt
from training_plan_generator.training_element import TrainingElement


class Day:
    def __init__(
            self,
            date: dt.datetime,
            training_sessions: Optional[List[TrainingElement]] = None
    ):
        self.date = date
        self.training_sessions = training_sessions

    def __repr__(self):
        return f"Day({self.date}, {self.training_sessions})"

    def __str__(self):
        return f"{self.date} {self.training_sessions}"

    def __len__(self):
        return len(self.training_sessions)

    def __getattr__(self, item):
        if item == 'total_duration':
            return sum(training_session.total_duration for training_session in self.training_sessions)
        if item == 'total_distance':
            return sum(training_session.total_distance for training_session in self.training_sessions)
        raise AttributeError(f"Day object has no attribute '{item}'")

    @property
    def json(self):
        return {
            "date": self.date,
            "training_sessions": [training_session.json for training_session in self.training_sessions]
        }

    def from_json(self, json_doc):
        self.date = json_doc["date"]
        self.training_sessions = [TrainingElement.from_json(training_session) for training_session in json_doc.get("training_sessions", [])]
        return self

    def add_training_session(self, training_session: TrainingElement):
        self.training_sessions.append(training_session)

    def remove_training_session(self, training_session: TrainingElement):
        self.training_sessions.remove(training_session)