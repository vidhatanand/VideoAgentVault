"""A slow status client must never lock out processor progress or completion."""
import importlib.util
import os
from pathlib import Path
import threading
import unittest

path=Path(os.environ.get('PROCESSOR_MODULE',Path(__file__).resolve().parents[1]/'processor/server.py'))
spec=importlib.util.spec_from_file_location('processor_http',path)
processor=importlib.util.module_from_spec(spec)
spec.loader.exec_module(processor)

class StatusConcurrencyTest(unittest.TestCase):
    def test_slow_response_does_not_block_status_updates(self):
        entered,release=threading.Event(),threading.Event()
        handler=processor.Handler.__new__(processor.Handler)
        handler.path='/status'
        def slow_send(value):
            entered.set()
            release.wait(2)
        handler.send=slow_send
        thread=threading.Thread(target=handler.do_GET)
        thread.start()
        try:
            self.assertTrue(entered.wait(1))
            acquired=processor.LOCK.acquire(timeout=.1)
            self.assertTrue(acquired,'HTTP response held the shared job-status lock')
            if acquired:
                processor.LOCK.release()
        finally:
            release.set()
            thread.join(2)
        self.assertFalse(thread.is_alive())
