import unittest,tempfile,wave,struct,sys,os
from pathlib import Path
sys.path.insert(0,str(Path(os.environ['PROCESSOR_MODULE']).parent if 'PROCESSOR_MODULE' in os.environ else Path(__file__).resolve().parents[1]/'processor'))
from audio_quality import silence_intervals
class AudioQuality(unittest.TestCase):
 def test_silence_keeps_original_timeline(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'audio.wav'
   with wave.open(str(p),'wb') as w:
    w.setparams((1,2,16000,0,'NONE','not compressed'))
    w.writeframes(struct.pack('<h',10000)*16000+b'\x00\x00'*32000)
   self.assertEqual(silence_intervals(p),[[1.0,3.0]])
