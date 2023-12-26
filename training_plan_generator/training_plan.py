class TrainingPlan:
    def __init__(
            self,
            phases: list,
            competitions: list = None,
    ):
        self.phases = phases
        self.competitions = competitions if competitions else []

    def __repr__(self):
        return f"TrainingPlan({self.phases}, {self.competitions})"

    def __str__(self):
        return f"Training Plan: {self.phases} {self.competitions}"