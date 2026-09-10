"""Real FFmpeg integration tests; no Cloudflare credentials or mocked codecs."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import wave

MODULE = Path(os.environ['PROCESSOR_MODULE']) if 'PROCESSOR_MODULE' in os.environ else Path(__file__).resolve().parents[1] / 'processor' / 'server.py'
spec = importlib.util.spec_from_file_location('processor', MODULE)
processor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(processor)

class LocalJob(processor.Job):
    def __init__(self, spec, media, dest):
        super().__init__(spec)
        self.media, self.dest = media, dest
    def download(self, url, target):
        source = self.media[url.rsplit("/", 1)[-1]] if isinstance(self.media, dict) else self.media
        shutil.copyfile(source, target)
        self.downloaded += target.stat().st_size
        return target
    def upload(self, file, relative, role='playback'):
        dest = self.dest / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, dest)
        self.uploaded += file.stat().st_size
        return f'jobs/{self.id}/{relative}'

class ProcessorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='er-real-ffmpeg-')
        cls.root = Path(cls.tmp.name)
        cls.media = cls.root / 'fixture.mp4'
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','4','-c:v','libx264','-preset','ultrafast','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',str(cls.media)],check=True)
    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()
    def run_job(self, kind, payload=None):
        dest=Path(tempfile.mkdtemp(prefix=kind+'-', dir=self.root))
        base='https://video.test';jid='j_processor'+kind
        spec={'id':jid,'videoId':'v_fixture','kind':kind,'baseUrl':base,'token':'local-test-only','maxWallSeconds':60,'sources':[{'id':'v_fixture','path':'source.mp4','url':base+'/source/'+jid+'/v_fixture/source.mp4'}],'payload':payload or {}}
        result=LocalJob(spec,self.media,dest).run()
        self.assertEqual(result['state'],'done',result)
        self.assertGreater(result['cpuSeconds'],0)
        return result,dest
    def test_process_diagnostics_clear_previous_exit_and_record_timeout(self):
        import sys
        job=processor.Job({'id':'j_diagnostics','baseUrl':'https://video.test','token':'test'})
        events=[]
        job.diagnostic_callback=events.append
        try:
            job.command([sys.executable,'-c','print(1)'])
            job.command([sys.executable,'-c','print(2)'])
            self.assertTrue(all('exitCode' not in e for e in events if e['processState'] in ('starting','running')))
            with self.assertRaisesRegex(processor.ProcessorError,'FFMPEG_TIME_LIMIT'):
                job.command([sys.executable,'-c','import time; time.sleep(2)'],timeout=.05)
            self.assertEqual(events[-1]['processState'],'exited')
            self.assertLess(events[-1]['exitCode'],0)
        finally:
            shutil.rmtree(job.root)

    def test_stream_import_retains_a_real_source_for_future_processing(self):
        result,dest=self.run_job('import', {'downloadUrl':'https://customer-test.cloudflarestream.com/fixture.mp4'})
        self.assertEqual(result['result']['sourcePath'], result['result']['primaryPath'])
        self.assertTrue((dest/'optimized.mp4').is_file())

    def test_probe_and_thumbnail(self):
        result,dest=self.run_job('probe')
        self.assertAlmostEqual(result['result']['durationSeconds'],4,delta=.1)
        self.assertEqual(result['result']['width'],640)
        self.assertTrue((dest/'poster.jpg').is_file())
    def test_real_encrypted_hls_and_decryption(self):
        result,dest=self.run_job('transcode',{'encrypted':True})
        master=dest/'hls'/'master.m3u8';self.assertIn('q360/index.m3u8',master.read_text())
        playlist=dest/'hls/q360/index.m3u8'
        self.assertIn('METHOD=AES-128',playlist.read_text())
        self.assertEqual((dest/'hls/q360/media.key').stat().st_size,16)
        # Decode all encrypted media with the valid key, not only inspect manifest text.
        subprocess.run(['ffmpeg','-v','error','-allowed_extensions','ALL','-protocol_whitelist','file,crypto,data','-i',str(playlist),'-f','null','-'],check=True,timeout=30)
    def test_index_emits_valid_wav_and_sampled_frame(self):
        result,dest=self.run_job('index',{'audio':True,'visual':True})
        units=result['result']['units']
        self.assertEqual({u['type'] for u in units},{'audio','frame'})
        with wave.open(str(dest/'analysis/audio-00000.wav')) as wav:
            self.assertEqual(wav.getframerate(),16000)
            self.assertEqual(wav.getnchannels(),1)
            self.assertGreater(wav.getnframes(),60000)
        self.assertTrue((dest/'analysis/frame-0000.jpg').is_file())
    def test_render_cuts_and_literal_text_overlay(self):
        timeline={'width':360,'height':640,'fit':'crop','fade':True,'clips':[{'videoId':'v_fixture','start':0,'end':1.3},{'videoId':'v_fixture','start':2,'end':3.3}],'textOverlays':[{'text':'Literal %{n} : no expression','start':0,'end':2.5,'position':'bottom'}]}
        result,dest=self.run_job('render',{'timeline':timeline,'encrypted':True})
        self.assertEqual(result['result']['width'],360)
        self.assertEqual(result['result']['height'],640)
        self.assertAlmostEqual(result['result']['durationSeconds'],2.6,delta=.2)
        self.assertTrue((dest/'render.mp4').is_file())

    def test_fullhd_profile_has_480_and_1080_without_upscaling(self):
        high = self.root/'high.mp4'
        subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','testsrc2=size=1920x1080:rate=15','-t','1','-c:v','libx264','-preset','ultrafast','-threads','1','-pix_fmt','yuv420p',str(high)],check=True)
        old=self.media
        try:
            self.media=high
            result,dest=self.run_job('transcode',{'profile':'fullhd','heights':[360,480,720,1080],'encrypted':True})
        finally:
            self.media=old
        self.assertEqual(result['result']['renditions'],[360,480,720,1080])
        self.assertIn('q1080/index.m3u8',(dest/'hls/master.m3u8').read_text())
        self.assertIn('q480/index.m3u8',(dest/'hls/master.m3u8').read_text())
        subprocess.run(['ffmpeg','-v','error','-allowed_extensions','ALL','-protocol_whitelist','file,crypto,data','-i',str(dest/'hls/q1080/index.m3u8'),'-f','null','-'],check=True,timeout=30)
    def test_preview_custom_poster_muted_clip_and_sprite_dimensions(self):
        result,dest=self.run_job('preview',{'timestampSeconds':1,'previewSeconds':2,'spriteFrames':12})
        for name in ['selected-poster.jpg','preview.mp4','sprite.jpg']:
            self.assertTrue((dest/name).is_file(),name)
        info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(dest/'preview.mp4')]))
        self.assertFalse(any(x['codec_type']=='audio' for x in info['streams']))
        self.assertAlmostEqual(float(info['format']['duration']),2,delta=.2)
        image=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(dest/'sprite.jpg')]))['streams'][0]
        self.assertEqual((image['width'],image['height']),(960,180))
        self.assertEqual(result['result']['spriteLayout']['count'],12)
    def test_mp4_and_audio_exports_are_bounded_and_not_primary_playback(self):
        for fmt in ['mp4','m4a']:
            result,dest=self.run_job('export',{'format':fmt,'startSeconds':1,'endSeconds':3})
            self.assertNotIn('primaryPath',result['result'])
            info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(dest/f'export.{fmt}')]))
            self.assertAlmostEqual(float(info['format']['duration']),2,delta=.1)
            self.assertEqual(any(x['codec_type']=='video' for x in info['streams']),fmt=='mp4')
    def test_alternate_audio_hls_group_is_encrypted_and_decodable(self):
        audio=self.root/'alternate.wav'
        subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','sine=frequency=880:sample_rate=48000','-t','4',str(audio)],check=True)
        dest=Path(tempfile.mkdtemp(prefix='alternate-',dir=self.root))
        base='https://video.test';jid='j_audio_fixture'
        sources=[{'id':'v_fixture','path':'source.mp4','url':base+'/source/'+jid+'/v_fixture/source.mp4'}, {'id':'v_audio','path':'alternate.wav','url':base+'/source/'+jid+'/v_audio/alternate.wav'}]
        spec={'id':jid,'videoId':'v_fixture','kind':'transcode','baseUrl':base,'token':'fixture','maxWallSeconds':60,'sources':sources,'payload':{'encrypted':True,'heights':[360],'audioTracks':[{'id':'tr_hindi','sourceVideoId':'v_audio','language':'hi','label':'Hindi','isDefault':True}]}}
        result=LocalJob(spec,{'source.mp4':self.media,'alternate.wav':audio},dest).run()
        self.assertEqual(result['state'],'done',result)
        master=(dest/'hls/master.m3u8').read_text()
        self.assertIn('GROUP-ID="audio"',master)
        self.assertIn('NAME="Hindi",LANGUAGE="hi",DEFAULT=YES',master)
        self.assertEqual(result['result']['packagedTracks'][0]['id'],'tr_hindi')
        for part in ['q360','audio0','audio1']:
            subprocess.run(['ffmpeg','-v','error','-allowed_extensions','ALL','-protocol_whitelist','file,crypto,data','-i',str(dest/f'hls/{part}/index.m3u8'),'-f','null','-'],check=True,timeout=30)
    def test_burned_in_logo_real_render(self):
        logo=self.root/'logo.png'
        subprocess.run(['ffmpeg','-y','-v','error','-f','lavfi','-i','color=c=white:size=100x50','-frames:v','1','-threads','1',str(logo)],check=True)
        dest=Path(tempfile.mkdtemp(prefix='logo-',dir=self.root));base='https://video.test';jid='j_logo_fixture'
        sources=[{'id':'v_fixture','path':'source.mp4','url':base+'/source/'+jid+'/v_fixture/source.mp4'}, {'id':'v_logo','path':'logo.png','url':base+'/source/'+jid+'/v_logo/logo.png'}]
        spec={'id':jid,'videoId':'v_fixture','kind':'export','baseUrl':base,'token':'fixture','maxWallSeconds':60,'sources':sources,'payload':{'format':'mp4','startSeconds':0,'endSeconds':1,'logoVideoId':'v_logo','logoPosition':'top-left','logoWidthPct':15}}
        result=LocalJob(spec,{'source.mp4':self.media,'logo.png':logo},dest).run()
        self.assertEqual(result['state'],'done',result)
        # Check a pixel inside the overlay, not merely whether the command returned success.
        pixel=subprocess.check_output(['ffmpeg','-v','error','-i',str(dest/'export.mp4'),'-vf','crop=2:2:30:30,format=rgb24','-frames:v','1','-f','rawvideo','-'])
        self.assertTrue(all(x>220 for x in pixel),pixel)

if __name__=='__main__':unittest.main(verbosity=2)
