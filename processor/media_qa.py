"""Deterministic output checks; model opinions never count as media validation."""
import math


def validate_output(measured, expected_seconds, *, video=True, audio=False, width=None, height=None):
    duration = measured.get('durationSeconds', 0)
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError('QA_INVALID_DURATION')
    tolerance = max(0.25, expected_seconds * 0.001)
    if abs(duration - expected_seconds) > tolerance:
        raise ValueError('QA_DURATION_MISMATCH')
    if video and not measured.get('hasVideo'):
        raise ValueError('QA_VIDEO_MISSING')
    if audio and not measured.get('hasAudio'):
        raise ValueError('QA_AUDIO_MISSING')
    if video and measured.get('videoCodec') != 'h264':
        raise ValueError('QA_VIDEO_CODEC_MISMATCH')
    if audio and measured.get('audioCodec') != 'aac':
        raise ValueError('QA_AUDIO_CODEC_MISMATCH')
    if width is not None and measured.get('width') != width:
        raise ValueError('QA_WIDTH_MISMATCH')
    if height is not None and measured.get('height') != height:
        raise ValueError('QA_HEIGHT_MISMATCH')
    return {'method': 'ffprobe-output-contract-v1', 'passed': True,
            'expectedDurationSeconds': expected_seconds, 'toleranceSeconds': tolerance,
            'measured': measured, 'factualContentChecked': False}
