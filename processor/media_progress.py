"""Measured, stage-local progress. No invented whole-job percentages."""
import math
import threading
import time
from pathlib import Path

class Progress:
    def __init__(self, publish=lambda value: None, clock=time.monotonic):
        self.publish, self.clock = publish, clock
        self.stage, self.started, self.samples = None, clock(), 0
        self.last = -1

    def update(self, stage, completed=0, total=None, unit=None):
        if stage != self.stage or completed < self.last:
            self.stage, self.started, self.samples, self.last = stage, self.clock(), 0, -1
        if completed > self.last:
            self.samples += 1
        self.last = completed
        elapsed = max(0, self.clock() - self.started)
        known = total is not None and math.isfinite(total) and total > 0
        eta = None
        if known and 0 < completed < total and elapsed >= 3 and self.samples >= 3:
            eta = round((total-completed)*elapsed/completed)
        value = dict(stage=stage, completed=completed, total=total if known else None,
                     unit=unit, elapsedSeconds=round(elapsed, 1), etaSeconds=eta,
                     updatedAt=round(time.time()*1000))
        self.publish(value)
        return value

    def ffmpeg(self, run, args, root, duration=None):
        target = Path(root) / 'ffmpeg-progress.txt'
        target.unlink(missing_ok=True)
        stop = threading.Event()
        self.update('encoding', 0, duration, 'seconds')
        def observe():
            last = -1
            while not stop.wait(.5):
                try:
                    values = dict(line.split('=', 1) for line in target.read_text().splitlines() if '=' in line)
                    done = max(0, int(values.get('out_time_us', 0))/1e6)
                    if duration:
                        done = min(done, duration)
                    if done > last:
                        self.update('encoding', done, duration, 'seconds')
                        last = done
                except (OSError, ValueError):
                    pass  # No measurement yet; never synthesize progress.
        watcher = threading.Thread(target=observe, daemon=True)
        watcher.start()
        try:
            return run(['ffmpeg', '-progress', str(target), '-nostats'] + args)
        finally:
            stop.set()
            watcher.join()
