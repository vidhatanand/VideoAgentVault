import importlib.util
import os
from pathlib import Path
import tempfile
import time
import unittest

spec=importlib.util.spec_from_file_location('media_progress',(Path(os.environ['PROCESSOR_MODULE']).parent if 'PROCESSOR_MODULE' in os.environ else Path(__file__).resolve().parents[1]/'processor')/'media_progress.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class ProgressTest(unittest.TestCase):
    def test_measured_eta_and_stage_reset(self):
        now=[0];p=module.Progress(clock=lambda:now[0])
        self.assertIsNone(p.update('downloading',0,100,'bytes')['etaSeconds'])
        now[0]=2;p.update('downloading',20,100,'bytes')
        now[0]=4;v=p.update('downloading',40,100,'bytes')
        self.assertEqual(v['etaSeconds'],6)
        self.assertIsNone(p.update('uploading',0,100,'bytes')['etaSeconds'])
        self.assertIsNone(p.update('encoding',10,None,'seconds')['etaSeconds'])

    def test_ffmpeg_observes_real_progress_file(self):
        values=[];p=module.Progress(values.append)
        with tempfile.TemporaryDirectory() as root:
            def command(args):
                target=Path(args[args.index('-progress')+1]);target.write_text('out_time_us=2000000\nprogress=continue\n');time.sleep(.7);return b'ok'
            self.assertEqual(p.ffmpeg(command,[],root,10),b'ok')
        self.assertTrue(any(v['completed']==2 and v['total']==10 for v in values))

if __name__=='__main__':unittest.main()
