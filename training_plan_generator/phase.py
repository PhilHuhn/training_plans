import time


class Phase:
    """
    A phase of a training plan.
    Typically, a phase is a period of time with a specific goal.
    Examples are:
    - Base building
    - Speed work
    - competition specific training
    - Tapering
    - competition
    - recovery
    """

    def __init__(
            self,
            name: str,
            start: int,
            end: int,
    ):
        self.name = name
        self.start = start
        self.end = end

    def __repr__(self):
        return f"Phase({self.name}, {time.ctime(self.start)}, {time.ctime(self.end)}"

    def __str__(self):
        return f"{self.name} ({time.ctime(self.start)} - {time.ctime(self.end)})"
