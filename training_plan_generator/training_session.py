class TrainingSession:
    def __init__(
            self,
            name: str,
            segments: list,
    ):
        self.name = name
        self.segments = segments

    def __repr__(self):
        return f"TrainingSession({self.name}, {self.segments})"

    def __str__(self):
        return f"Training Session: {self.name} {self.segments}"

    @property
    def duration(self):
        duration = 0
        for segment in self.segments:
            duration += segment.duration
        return duration

    @property
    def distance(self):
        distance = 0
        for segment in self.segments:
            distance += segment.distance
        return distance
