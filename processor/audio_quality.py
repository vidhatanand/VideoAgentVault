"""Measure silence on extracted PCM without changing the original timeline."""
import wave
import struct

def silence_intervals(path, threshold_db=-45, minimum_seconds=.5):
    with wave.open(str(path), 'rb') as wav:
        if wav.getsampwidth()!=2 or wav.getnchannels()!=1:
            raise ValueError('PCM_MONO_16_REQUIRED')
        rate=wav.getframerate();size=max(1,rate//50);threshold=32768*10**(threshold_db/20)
        position=0;start=None;result=[]
        while True:
            raw=wav.readframes(size)
            if not raw:break
            values=struct.unpack('<'+'h'*(len(raw)//2),raw)
            quiet=max(map(abs,values),default=0)<threshold
            if quiet and start is None:start=position/rate
            if not quiet and start is not None:
                if position/rate-start>=minimum_seconds:result.append([start,position/rate])
                start=None
            position+=len(values)
        if start is not None and position/rate-start>=minimum_seconds:result.append([start,position/rate])
        return result
