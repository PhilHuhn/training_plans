import unittest
from training_plan_generator import Segment


class TestSegment(unittest.TestCase):
    def setUp(self):
        pass

    def test_init(self):
        segment = Segment("test", 3600, 10000)
        self.assertEqual(segment.name, "test")
        self.assertEqual(segment.duration, 3600)
        self.assertEqual(segment.distance, 10000)
        self.assertEqual(segment.pace, 0.36)

    def tearDown(self):
        pass


if __name__ == '__main__':
    unittest.main()
