from typing import List, Optional
import datetime as dt


class TrainingElement:
    """
    A training element is a single unit of a training plan.
    It can be a single workout or a group of workouts.

    A training element has a name, a duration, a distance, and a number of repetitions.
    It can also have children, which are other training elements.

    The total duration and distance of a training element is the sum of the duration and distance of the element
    and all its children.

    Example:
    - A training element can be a single workout, e.g. a 10k run.
    - A training element can be a group of workouts, e.g. a long run with a warm-up, a main workout, and a cool-down.

    :param name: The name of the training element.
    :param duration: The duration of the training element.
    :param distance: The distance of the training element.
    :param repetitions: The number of repetitions of the training element.
    :param children: The children of the training element.
    """
    def __init__(
            self,
            name: str,
            duration: dt.timedelta,
            distance: float,
            repetitions: Optional[int] = 1,
            time_of_day: Optional[str] = None,
            intensity: Optional[str] = None,
            terrain: Optional[str] = None,
            children: Optional[List['TrainingElement']] = None,
    ):
        self.name = name
        self.duration = duration
        self.distance = distance
        self.repetitions = repetitions
        self.time_of_day = time_of_day
        self.intensity = intensity
        self.terrain = terrain
        self.children = children if children is not None else []

    def __repr__(self):
        return f"TrainingElement({self.name}, {self.duration}, {self.distance}, {self.repetitions}, {self.children})"

    def __str__(self):
        return f"{self.name} {self.duration} {self.distance} {self.repetitions} {self.children}"

    @property
    def total_duration(self):
        return self.duration * self.repetitions + sum(child.total_duration for child in self.children)

    @property
    def total_distance(self):
        return self.distance * self.repetitions + sum(child.total_distance for child in self.children)

    @property
    def json(self):
        return {
            "name": self.name,
            "duration": self.duration.total_seconds(),
            "distance": self.distance,
            "repetitions": self.repetitions,
            "time_of_day": self.time_of_day,
            "intensity": self.intensity,
            "terrain": self.terrain,
            "children": [child.json for child in self.children]
        }

    def add_child(self, child: 'TrainingElement'):
        self.children.append(child)

    def from_json(self, json_doc):
        self.name = json_doc["name"]
        self.duration = dt.timedelta(seconds=json_doc["duration"])
        self.distance = json_doc["distance"]
        self.repetitions = json_doc.get("repetitions", 1)
        self.time_of_day = json_doc.get("time_of_day")
        self.intensity = json_doc.get("intensity")
        self.terrain = json_doc.get("terrain")
        self.children = [TrainingElement().from_json(child) for child in json_doc["children"]]
        return self