import os
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(os.environ['PROCESSOR_MODULE']).parent if 'PROCESSOR_MODULE' in os.environ else Path(__file__).resolve().parents[1] / 'processor'))
from media_qa import validate_output


class MediaQualityTests(unittest.TestCase):
    def test_measured_export_with_frame_tolerance(self):
        measured = dict(durationSeconds=10.04, hasVideo=True, hasAudio=True,
                        videoCodec='h264', audioCodec='aac', width=1920, height=1080)
        self.assertTrue(validate_output(measured, 10, audio=True, width=1920)['passed'])
        for change, code in [({'durationSeconds': 11}, 'DURATION'), ({'hasAudio': False}, 'AUDIO_MISSING'),
                             ({'videoCodec': 'hevc'}, 'CODEC'), ({'width': 1280}, 'WIDTH')]:
            with self.assertRaisesRegex(ValueError, code):
                validate_output({**measured, **change}, 10, audio=True, width=1920)

    def test_audio_only_does_not_invent_a_video(self):
        result = validate_output(dict(durationSeconds=10, hasAudio=True, audioCodec='aac'), 10, video=False, audio=True)
        self.assertFalse(result['factualContentChecked'])
