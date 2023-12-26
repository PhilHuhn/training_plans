class Segment:
    def __init__(self, name, duration, distance):
        self.name = name
        self.duration = duration  # duration in seconds
        self.distance = distance  # distance in meters

    def __repr__(self):
        return f"Segment({self.name}, {self.duration}, {self.distance}, {self.pace})"

    def __str__(self):
        return f"Segment: {self.name} {self.duration} {self.distance} {self.pace}"

    @property
    def pace(self):
        return self.duration / self.distance

