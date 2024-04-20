import unittest
import datetime as dt
from training_plan_generator.training_element import TrainingElement


class TrainingElementTestCase(unittest.TestCase):
    def training_element_creation_with_valid_parameters(self):
        element = TrainingElement(
            name="test",
            duration=dt.timedelta(minutes=60),
            distance=10000,
            repetitions=1
        )
        self.assertEqual(element.name, "test")
        self.assertEqual(element.duration, dt.timedelta(minutes=60))
        self.assertEqual(element.distance, 10000)
        self.assertEqual(element.repetitions, 1)
        self.assertEqual(element.children, [])

    def training_element_creation_with_children(self):
        child = TrainingElement(
            name="child",
            duration=dt.timedelta(minutes=30),
            distance=5000,
            repetitions=2
        )
        element = TrainingElement(
            name="test",
            duration=dt.timedelta(minutes=60),
            distance=10000,
            repetitions=1,
            children=[child]
        )
        self.assertEqual(element.total_duration, dt.timedelta(minutes=120))
        self.assertEqual(element.total_distance, 20000)

    def training_element_creation_with_invalid_duration(self):
        with self.assertRaises(TypeError):
            TrainingElement(
                name="test",
                duration="60",
                distance=10000,
                repetitions=1
            )

    def training_element_creation_with_invalid_distance(self):
        with self.assertRaises(TypeError):
            TrainingElement(
                name="test",
                duration=dt.timedelta(minutes=60),
                distance="10000",
                repetitions=1
            )

    def training_element_creation_with_invalid_repetitions(self):
        with self.assertRaises(TypeError):
            TrainingElement(
                name="test",
                duration=dt.timedelta(minutes=60),
                distance=10000,
                repetitions="1"
            )

    def training_element_creation_with_negative_repetitions(self):
        with self.assertRaises(ValueError):
            TrainingElement(
                name="test",
                duration=dt.timedelta(minutes=60),
                distance=10000,
                repetitions=-1
            )

    def training_element_json_representation(self):
        element = TrainingElement(
            name="test",
            duration=dt.timedelta(minutes=60),
            distance=10000,
            repetitions=1
        )
        expected_json = {
            "name": "test",
            "duration": 3600.0,
            "distance": 10000,
            "repetitions": 1,
            "children": []
        }
        self.assertEqual(element.json, expected_json)

    def training_element_json_representation_with_children(self):
        child = TrainingElement(
            name="child",
            duration=dt.timedelta(minutes=30),
            distance=5000,
            repetitions=2
        )
        element = TrainingElement(
            name="test",
            duration=dt.timedelta(minutes=60),
            distance=10000,
            repetitions=1,
            children=[child]
        )
        expected_json = {
            "name": "test",
            "duration": 3600.0,
            "distance": 10000,
            "repetitions": 1,
            "children": [{
                "name": "child",
                "duration": 1800.0,
                "distance": 5000,
                "repetitions": 2,
                "children": []
            }]
        }
        self.assertEqual(element.json, expected_json)


if __name__ == '__main__':
    unittest.main()
