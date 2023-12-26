class UnitConverter:
    def __init__(
            self,
            input_unit,
            output_unit
    ):
        self.input_unit = input_unit
        self.output_unit = output_unit

    def __repr__(self):
        return f"UnitConverter({self.input_unit}, {self.output_unit})"

    def __str__(self):
        return f"UnitConverter: {self.input_unit} {self.output_unit}"

    def convert(self, value):
        if self.input_unit == self.output_unit:
            return value
        elif self.input_unit == "m" and self.output_unit == "km":
            return value / 1000
        elif self.input_unit == "km" and self.output_unit == "m":
            return value * 1000
        elif self.input_unit == "s" and self.output_unit == "min":
            return value / 60
        elif self.input_unit == "min" and self.output_unit == "s":
            return value * 60
        elif self.input_unit == "min/km" and self.output_unit == "min/m":
            return value / 1000
        elif self.input_unit == "min/m" and self.output_unit == "min/km":
            return value * 1000
        elif self.input_unit == "min/km" and self.output_unit == "min/m":
            return value / 1000
        elif self.input_unit == "min/m" and self.output_unit == "min/km":
            return value * 1000
        elif self.input_unit == "s/m" and self.output_unit == "min/km":
            return value / 60
        elif self.input_unit == "km/h" and self.output_unit == "m/s":
            return value / 3.6
        elif self.input_unit == "m/s" and self.output_unit == "km/h":
            return value * 3.6
        else:
            raise ValueError(f"Cannot convert from {self.input_unit} to {self.output_unit}")