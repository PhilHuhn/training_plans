from typing import List, Optional

import datetime as dt
from .day import Day


class Phase:
    def __init__(
            self,
            name: str,
            days: Optional[List[Day]] = None,
            start: Optional[dt.datetime] = None,
            end: Optional[dt.datetime] = None,
    ):
        self.name = name
        self.start = start
        self.end = end
        self.days = days

    def __repr__(self):
        return f"Phase({self.name}, {self.start}, {self.end}, {self.days})"

    def __str__(self):
        return f"{self.name} {self.start} {self.end} {self.days}"

    def __getattr__(self, item):
        if item == 'duration':
            return self.end - self.start

    @property
    def json(self):
        return {
            "name": self.name,
            "start": self.start,
            "end": self.end,
            "days": [day.json for day in self.days]
        }

    def from_json(self, json_doc):
        self.name = json_doc.get("name")
        self.start = json_doc.get("start")
        self.end = json_doc.get("end")
        self.days = [Day.from_json(day) for day in json_doc.get("days", [])]
        return self
