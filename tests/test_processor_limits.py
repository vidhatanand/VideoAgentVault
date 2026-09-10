"""Source ceilings without allocating multi-gigabyte fixtures."""
import shutil
import unittest
from test_processor import processor

class SourceLimitsTest(unittest.TestCase):
    def test_source_limit_default_override_and_hard_ceiling(self):
        for requested, expected in [(None, 3 * 1024**3), (2305279190, 2305279190), (10 * 1024**3, 3 * 1024**3)]:
            spec = {'id': 'j_limits', 'baseUrl': 'https://video.test', 'token': 'local-test-only'}
            if requested is not None:
                spec['maxSourceBytes'] = requested
            job = processor.Job(spec)
            try:
                self.assertEqual(job.max_source, expected)
            finally:
                shutil.rmtree(job.root)
