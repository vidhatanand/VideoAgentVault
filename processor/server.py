#!/usr/bin/env python3
"""Bounded FFmpeg jobs for Cloudflare Containers. Standard library only.

No shell execution, arbitrary filters, tenant credentials, callback URLs from model
outputs, public storage, or indefinitely running ingestion. The Worker issues a
short-lived per-job capability, not an R2/API account credential.
"""
from __future__ import annotations
from media_qa import validate_output
import concurrent.futures
import copy
import hashlib
import http.client
import http.server
import ipaddress
import json
import math
import os
from pathlib import Path
import resource
import secrets
import shutil
import signal
import socket
import ssl
import subprocess
import tempfile
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from media_progress import Progress
from audio_quality import silence_intervals
import threading
import time
import urllib.parse

PART = 8 * 1024 * 1024
STATUS = {"state": "starting"}
LOCK = threading.Lock()
POOL = concurrent.futures.ThreadPoolExecutor(max_workers=1)

def cpu_seconds():
    a = resource.getrusage(resource.RUSAGE_SELF)
    b = resource.getrusage(resource.RUSAGE_CHILDREN)
    return a.ru_utime + a.ru_stime + b.ru_utime + b.ru_stime

class ProcessorError(Exception):
    pass

class PinnedHTTPS(http.client.HTTPSConnection):
    """Resolve once, reject private ranges, retain TLS hostname verification."""
    def connect(self):
        addresses = socket.getaddrinfo(self.host, self.port, type=socket.SOCK_STREAM)
        public = [r[4][0] for r in addresses if ipaddress.ip_address(r[4][0]).is_global]
        if not public or len(public) != len(addresses):
            raise ProcessorError("SOURCE_RESOLVED_TO_NON_PUBLIC_ADDRESS")
        raw = socket.create_connection((public[0], self.port), self.timeout)
        self.sock = self._context.wrap_socket(raw, server_hostname=self.host)

def request(url: str, method="GET", data=None, headers=None, local=False):
    u = urllib.parse.urlsplit(url)
    if u.username or u.password or u.fragment:
        raise ProcessorError("INVALID_URL")
    h = dict(headers or {})
    path = urllib.parse.urlunsplit(("", "", u.path or "/", u.query, ""))
    if u.scheme == "http" and local and u.hostname in ("localhost", "127.0.0.1"):
        conn = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=60)
    elif u.scheme == "https" and (u.port or 443) == 443:
        conn = PinnedHTTPS(u.hostname, 443, timeout=60, context=ssl.create_default_context())
    else:
        raise ProcessorError("HTTPS_SOURCE_REQUIRED")
    conn.request(method, path, body=data, headers=h)
    res = conn.getresponse()
    # Never follow redirects: that reopens SSRF or leaks signed job capabilities.
    if not 200 <= res.status < 300:
        status = res.status
        res.read(1000)
        conn.close()
        raise ProcessorError(f"HTTP_STATUS_{status}")
    return conn, res

class Job:
    def __init__(self, spec: dict, workdir: Path | None = None, progress=None):
        self.progress = Progress(progress or (lambda value: None))
        self.media_durations = {}
        self.diagnostics = {"stage": "initializing", "commandCount": 0}
        self.diagnostic_callback = lambda value: None
        self.s = spec
        self.id = spec["id"]
        if not isinstance(self.id, str) or not self.id.replace("_", "").isalnum():
            raise ProcessorError("INVALID_JOB_ID")
        self.root = workdir or Path(tempfile.mkdtemp(prefix="videoagentvault-"))
        self.root.mkdir(exist_ok=True, parents=True)
        self.started = time.monotonic()
        self.cpu_start = cpu_seconds()
        self.limit = min(3600, max(30, int(spec.get("maxWallSeconds", 900))))
        self.max_source = min(3 * 1024**3, int(spec.get("maxSourceBytes", 3 * 1024**3)))
        self.max_output = min(3 * 1024**3, int(spec.get("maxOutputBytes", 3 * 1024**3)))
        self.uploaded = 0
        self.downloaded = 0
        self.output_total = 0
        self.local = os.environ.get("VIDEOAGENTVAULT_LOCAL") == "1"
        self.base = spec["baseUrl"].rstrip("/")
        self.token = spec["token"]
        self.p = spec.get("payload", {})
        self.sources: dict[str, Path] = {}

    def remaining(self):
        left = self.limit - (time.monotonic() - self.started)
        if left < 2:
            raise ProcessorError("JOB_TIME_BUDGET_EXCEEDED")
        return left

    def command(self, args, timeout=None):
        self.remaining()
        self.diagnostics.pop("exitCode", None)
        self.diagnostics.pop("pid", None)
        self.diagnostics.update(commandCount=self.diagnostics["commandCount"]+1, executable=Path(args[0]).name, processState="starting")
        self.diagnostic_callback(dict(self.diagnostics))
        p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             start_new_session=True, cwd=self.root)
        self.diagnostics.update(pid=p.pid, processState="running")
        self.diagnostic_callback(dict(self.diagnostics))
        try:
            stdout, stderr = p.communicate(timeout=min(timeout or self.remaining(), self.remaining()))
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
            p.communicate()
            self.diagnostics.update(processState="exited", exitCode=p.returncode)
            self.diagnostic_callback(dict(self.diagnostics))
            raise ProcessorError("FFMPEG_TIME_LIMIT") from None
        self.diagnostics.update(processState="exited", exitCode=p.returncode)
        self.diagnostic_callback(dict(self.diagnostics))
        if p.returncode:
            # ffmpeg errors may echo signed source URLs. Do not leak them to API/logs.
            raise ProcessorError("MEDIA_COMMAND_FAILED")
        if sum(f.stat().st_size for f in self.root.rglob("*") if f.is_file()) > 9 * 1024**3:
            raise ProcessorError("WORKSPACE_DISK_LIMIT")
        return stdout

    def ffmpeg(self, args):
        inputs = [args[i+1] for i, item in enumerate(args[:-1]) if item == "-i"]
        duration = self.media_durations.get(str(inputs[0])) if len(inputs) == 1 else None
        if "-frames:v" in args or "-f" in args and "image2" in args:
            duration = None
        elif "-t" in args:
            duration = float(args[args.index("-t")+1])
        return self.progress.ffmpeg(self.command, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-threads", "1"] + args, self.root, duration)

    def download(self, url, target: Path):
        self.remaining()
        conn, res = request(url, local=self.local)
        length = int(res.getheader("Content-Length") or 0)
        if length > self.max_source:
            conn.close()
            raise ProcessorError("SOURCE_TOO_LARGE")
        total = 0
        self.progress.update("downloading", 0, length, "bytes")
        try:
            with target.open("wb") as out:
                while True:
                    self.remaining()
                    chunk = res.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    self.downloaded += len(chunk)
                    if total > self.max_source or self.downloaded > 4 * 1024**3:
                        raise ProcessorError("SOURCE_TOO_LARGE")
                    out.write(chunk)
                    self.progress.update("downloading", total, length, "bytes")
        finally:
            conn.close()
        if length and total != length:
            raise ProcessorError("TRUNCATED_SOURCE")
        return target

    def api(self, path, method="POST", body=None, content_type="application/json"):
        self.remaining()
        if isinstance(body, dict):
            body = json.dumps(body).encode()
        url = f"{self.base}/api/internal/jobs/{self.id}/{path}"
        url += ("&" if "?" in url else "?") + "token=" + urllib.parse.quote(self.token)
        for attempt in range(3):
            try:
                conn, res = request(url, method, body, {"Content-Type": content_type}, local=self.local)
                raw = res.read(1024 * 1024)
                conn.close()
                self.uploaded += len(body or b"")
                return json.loads(raw) if raw else {}
            except (OSError, TimeoutError):
                if attempt == 2:
                    raise ProcessorError("OUTPUT_TRANSFER_FAILED") from None
                time.sleep(0.5 * (attempt + 1))
        raise ProcessorError("OUTPUT_TRANSFER_FAILED")

    def upload(self, file: Path, relative: str, role="playback"):
        size = file.stat().st_size
        self.output_total += size
        if self.output_total > self.max_output:
            raise ProcessorError("OUTPUT_BYTE_BUDGET_EXCEEDED")
        self.progress.update("uploading", 0, size, "bytes")
        sent = 0
        path = f"jobs/{self.id}/{relative}"
        if size <= PART:
            self.api("asset/" + path + "?role=" + role, "PUT", file.read_bytes(), "application/octet-stream")
        else:
            upload = self.api("uploads", body={"path": path, "size": size, "role": role})
            if not upload.get("completed"):
                with file.open("rb") as f:
                    part = 1
                    while True:
                        chunk = f.read(PART)
                        if not chunk:
                            break
                        self.api(f"uploads/{upload['id']}/parts/{part}", "PUT", chunk, "application/octet-stream")
                        sent += len(chunk)
                        self.progress.update("uploading", sent, size, "bytes")
                        part += 1
                self.api(f"uploads/{upload['id']}/complete", body={})
        self.progress.update("uploading", size, size, "bytes")
        return path

    def probe(self, file: Path):
        self.progress.update("probing")
        data = json.loads(self.command(["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe,crypto,data", "-show_format", "-show_streams", "-of", "json", str(file)]))
        streams = data.get("streams", [])
        video = next((s for s in streams if s.get("codec_type") == "video"), None)
        duration = float(data.get("format", {}).get("duration") or (video or {}).get("duration") or 0)
        if not math.isfinite(duration) or duration <= 0 or duration > 14400:
            raise ProcessorError("SOURCE_DURATION_MUST_BE_0_TO_4_HOURS")
        self.media_durations[str(file)] = duration
        width, height = (int((video or {}).get("width", 0)), int((video or {}).get("height", 0)))
        if width > 4096 or height > 4096:
            raise ProcessorError("SOURCE_RESOLUTION_LIMIT_4096")
        return {"durationSeconds": duration, "width": width, "height": height,
                "hasVideo": video is not None, "hasAudio": any(s.get("codec_type") == "audio" for s in streams),
                "videoCodec": (video or {}).get("codec_name", "none"),
                "audioCodec": next((s.get("codec_name") for s in streams if s.get("codec_type") == "audio"), "none"),
                "pixelFormat": (video or {}).get("pix_fmt", "none"),
                "browserCompatible": bool(video and video.get("codec_name") == "h264" and video.get("pix_fmt") == "yuv420p" and all(s.get("codec_name") == "aac" for s in streams if s.get("codec_type") == "audio"))}

    def input_args(self, source):
        return ["-protocol_whitelist", "file,pipe,crypto,data", "-i", str(source)]

    def poster(self, source, info):
        if not info["hasVideo"]:
            return None
        dest = self.root / "poster.jpg"
        self.ffmpeg(["-ss", str(min(info["durationSeconds"] / 3, 5))] + self.input_args(source) + ["-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", str(dest)])
        return self.upload(dest, "poster.jpg", "thumbnail")

    def transcode(self, source, info):
        if not info["hasVideo"]:
            raise ProcessorError("VIDEO_TRACK_REQUIRED")
        hmax = info["height"]
        heights = [h for h in self.p.get("heights", [360, 480, 720, 1080] if self.p.get("fullHD") else [360, 480, 720]) if h <= hmax]
        if not heights:
            heights = [max(2, hmax // 2 * 2)]
        output = self.root / "hls"
        output.mkdir(exist_ok=True)
        encrypted = self.p.get("encrypted", True)
        master = ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-INDEPENDENT-SEGMENTS"]
        audio_tracks = self.p.get("audioTracks", [])
        packaged = []
        separate_audio = bool(audio_tracks)
        if separate_audio:
            default_alt = next((t["id"] for t in audio_tracks if t.get("isDefault")), None)
            tracks = ([{"id": "original", "sourceVideoId": None, "language": "und", "label": "Original"}] if info["hasAudio"] else []) + audio_tracks
            if not default_alt and tracks:
                default_alt = tracks[0]["id"]
            for i, track in enumerate(tracks):
                audio_source = source if track["sourceVideoId"] is None else self.sources[track["sourceVideoId"]]
                ai = self.probe(audio_source)
                if not ai["hasAudio"] or abs(ai["durationSeconds"]-info["durationSeconds"]) > 2:
                    raise ProcessorError("AUDIO_DURATION_MUST_MATCH_WITHIN_TWO_SECONDS")
                folder = output / f"audio{i}"
                folder.mkdir()
                args = self.input_args(audio_source) + ["-vn", "-af", "apad", "-t", str(info["durationSeconds"]), "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000", "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod", "-hls_segment_filename", str(folder/"seg%06d.ts")]
                if encrypted:
                    key = folder / "media.key"
                    key.write_bytes(secrets.token_bytes(16))
                    ki = self.root / f"audio-key{i}.txt"
                    ki.write_text("media.key\n" + str(key) + "\n" + secrets.token_hex(16) + "\n")
                    args += ["-hls_key_info_file", str(ki)]
                self.ffmpeg(args + [str(folder/"index.m3u8")])
                label = track["label"].replace('"', "'").replace("\n", " ").replace("\r", " ")
                default = "YES" if track["id"] == default_alt else "NO"
                master.append(f'#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="{label}",LANGUAGE="{track["language"]}",DEFAULT={default},AUTOSELECT=YES,URI="audio{i}/index.m3u8"')
                if track["id"] != "original":
                    packaged.append({"id": track["id"], "path": f"jobs/{self.id}/hls/audio{i}/index.m3u8"})
        for height in heights:
            self.diagnostics.update(stage="encoding", rendition=height)
            self.diagnostic_callback(dict(self.diagnostics))
            name = f"q{height}"
            folder = output / name
            folder.mkdir(exist_ok=True)
            rate = 700 if height <= 360 else 1200 if height <= 480 else 2200 if height <= 720 else 4200
            args = self.input_args(source) + ["-map", "0:v:0", "-map", "0:a:0?", "-vf", f"scale=-2:{height}", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-profile:v", "main", "-g", "180", "-keyint_min", "180", "-sc_threshold", "0", "-b:v", f"{rate}k", "-maxrate", f"{int(rate*1.1)}k", "-bufsize", f"{rate*2}k", "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-ar", "48000", "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod", "-hls_flags", "independent_segments", "-hls_segment_filename", str(folder / "seg%06d.ts")]
            if separate_audio:
                args += ["-an"]
            if encrypted:
                key = folder / "media.key"
                key.write_bytes(secrets.token_bytes(16))
                # Random IV + key per rendition; key never exposed in a public bucket.
                ki = self.root / f"keyinfo-{name}.txt"
                ki.write_text("media.key\n" + str(key) + "\n" + secrets.token_hex(16) + "\n")
                args += ["-hls_key_info_file", str(ki)]
            args += [str(folder / "index.m3u8")]
            self.ffmpeg(args)
            width = max(2, round(info["width"] * height / hmax / 2) * 2)
            master += [f"#EXT-X-STREAM-INF:BANDWIDTH={int(rate*1100+160000)},RESOLUTION={width}x{height}" + (',AUDIO="audio"' if separate_audio else ""), f"{name}/index.m3u8"]
        (output / "master.m3u8").write_text("\n".join(master) + "\n")
        # Assets first, playlists last; the Worker publishes primary_path only after job completion.
        files = sorted(output.rglob("*"), key=lambda p: (p.suffix == ".m3u8", str(p)))
        for f in files:
            if f.is_file():
                self.upload(f, "hls/" + f.relative_to(output).as_posix())
        return {"primaryPath": f"jobs/{self.id}/hls/master.m3u8", "kind": "hls", "encrypted": encrypted, "renditions": heights, "packagedTracks": packaged, "profile": self.p.get("profile", "balanced"), **info}

    def branding_source(self, source, info):
        logo_id = self.p.get("logoVideoId")
        if not logo_id:
            return source
        logo = self.sources[logo_id]
        dest = self.root / "branded.mp4"
        w = max(16, round(info["width"] * self.p.get("logoWidthPct", 15) / 100 / 2) * 2)
        pos = self.p.get("logoPosition", "bottom-right")
        x = "20" if pos.endswith("left") else "W-w-20"
        y = "20" if pos.startswith("top") else "H-h-20"
        graph = f"[1:v]scale={w}:-2[logo];[0:v][logo]overlay={x}:{y}:eof_action=repeat[v]"
        self.ffmpeg(self.input_args(source) + self.input_args(logo) + ["-filter_complex_threads", "1", "-filter_complex", graph, "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", str(dest)])
        return dest

    def preview(self, source, info):
        if not info["hasVideo"]:
            raise ProcessorError("VIDEO_TRACK_REQUIRED")
        ts = min(float(self.p.get("timestampSeconds", 0)), info["durationSeconds"]-0.05)
        poster = self.root/"selected-poster.jpg"
        self.ffmpeg(["-ss", str(max(0, ts))] + self.input_args(source) + ["-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", str(poster)])
        length = min(float(self.p.get("previewSeconds", 6)), info["durationSeconds"]-ts)
        preview = self.root/"preview.mp4"
        self.ffmpeg(["-ss", str(max(0, ts))] + self.input_args(source) + ["-t", str(length), "-an", "-vf", "scale=480:-2,fps=15", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(preview)])
        count = int(self.p.get("spriteFrames", 12))
        columns = min(6, count)
        rows = math.ceil(count/columns)
        sheet = self.root/"sprite.jpg"
        tile_h = max(2, round(160*info["height"]/info["width"]/2)*2)
        self.ffmpeg(self.input_args(source) + ["-vf", f"fps={count/info['durationSeconds']},scale=160:{tile_h},tile={columns}x{rows}", "-frames:v", "1", "-q:v", "3", str(sheet)])
        qa = validate_output(self.probe(preview), length, video=True)
        return {"quality": qa, "thumbnailPath": self.upload(poster,"selected-poster.jpg","thumbnail"),
                "previewPath": self.upload(preview,"preview.mp4","thumbnail"),
                "spritePath": self.upload(sheet,"sprite.jpg","thumbnail"),
                "spriteLayout": {"columns": columns, "rows": rows, "width": 160, "height": tile_h, "count": count, "intervalSeconds": info["durationSeconds"]/count}}

    def export_media(self, source, info):
        fmt = self.p.get("format", "mp4")
        if fmt not in ("mp4", "m4a"):
            raise ProcessorError("INVALID_EXPORT_FORMAT")
        start = float(self.p.get("startSeconds", 0))
        end = self.p.get("endSeconds")
        end = info["durationSeconds"] if end is None else float(end)
        if start < 0 or end <= start or end > info["durationSeconds"]+0.05:
            raise ProcessorError("INVALID_EXPORT_RANGE")
        dest = self.root/f"export.{fmt}"
        args = ["-ss", str(start)] + self.input_args(source) + ["-t", str(end-start)]
        if fmt == "m4a":
            if not info["hasAudio"]:
                raise ProcessorError("AUDIO_TRACK_REQUIRED")
            args += ["-vn", "-c:a", "aac", "-b:a", "128k"]
        else:
            args += ["-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac"]
        self.ffmpeg(args + ["-movflags", "+faststart", str(dest)])
        qa = validate_output(self.probe(dest), end-start, video=fmt == "mp4", audio=bool(info["hasAudio"]))
        return {"quality": qa, "exportPath": self.upload(dest, f"export.{fmt}", "generated"), "exportFormat": fmt, "exportDurationSeconds": end-start}

    def extract_index(self, source, info):
        units = []
        chunk_seconds = int(self.p.get("audioChunkSeconds", 60))
        if chunk_seconds not in (30, 60):
            raise ProcessorError("INVALID_AUDIO_CHUNK_INTERVAL")
        if self.p.get("audio", True) and info["hasAudio"]:
            folder = self.root / "audio"
            folder.mkdir()
            self.ffmpeg(self.input_args(source) + ["-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "segment", "-segment_time", str(chunk_seconds), "-reset_timestamps", "1", str(folder / "%05d.wav")])
            for i, f in enumerate(sorted(folder.glob("*.wav"))):
                if i >= 14400//chunk_seconds:
                    raise ProcessorError("TOO_MANY_AUDIO_CHUNKS")
                path = self.upload(f, f"analysis/audio-{i:05d}.wav", "analysis")
                units.append({"type": "audio", "path": path, "start": i*chunk_seconds, "end": min(info["durationSeconds"], (i+1)*chunk_seconds), "silence": silence_intervals(f)})
        if self.p.get("visual", True) and info["hasVideo"]:
            count = min(60, max(1, math.ceil(info["durationSeconds"] / int(self.p.get("visualIntervalSeconds", 30)))))
            for i in range(count):
                ts = min(info["durationSeconds"] - 0.05, (i + 0.5) * info["durationSeconds"] / count)
                f = self.root / f"frame-{i:04d}.jpg"
                self.ffmpeg(["-ss", str(max(0, ts))] + self.input_args(source) + ["-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", str(f)])
                path = self.upload(f, f"analysis/frame-{i:04d}.jpg", "analysis")
                units.append({"type": "frame", "path": path, "start": ts, "end": ts})
        return {"units": units, **info, "coverage": "Complete bounded audio in valid WAV chunks; up to 60 sampled visual frames."}

    def render(self):
        timeline = self.p["timeline"]
        width, height = timeline["width"], timeline["height"]
        clips = []
        duration = 0
        for i, clip in enumerate(timeline["clips"]):
            source = self.sources[clip["videoId"]]
            info = self.probe(source)
            length = clip["end"] - clip["start"]
            if not 0 < length <= 3600 or clip["end"] > info["durationSeconds"] + 0.2:
                raise ProcessorError("INVALID_CLIP_RANGE")
            crop = timeline.get("fit") == "crop"
            vf = f"scale={width}:{height}:force_original_aspect_ratio={'increase' if crop else 'decrease'}," + (f"crop={width}:{height}" if crop else f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2") + ",setsar=1,fps=30"
            if timeline.get("fade") and length > 0.5:
                vf += f",fade=t=in:st=0:d=0.2,fade=t=out:st={length-0.2}:d=0.2"
            target = self.root / f"clip-{i:03d}.mp4"
            args = ["-ss", str(clip["start"])] + self.input_args(source)
            if not info["hasAudio"]:
                args += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]
            args += ["-t", str(length), "-map", "0:v:0", "-map", "0:a:0" if info["hasAudio"] else "1:a:0", "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(target)]
            self.ffmpeg(args)
            clips.append(target)
            duration += length
        listing = self.root / "clips.txt"
        listing.write_text("\n".join(f"file '{f.name}'" for f in clips))
        merged = self.root / "merged.mp4"
        self.ffmpeg(["-f", "concat", "-safe", "1", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(merged)])
        filters = []
        for i, overlay in enumerate(timeline.get("textOverlays", [])):
            txt = self.root / f"overlay-{i}.txt"
            txt.write_text(overlay["text"])
            y = {"top": "30", "center": "(h-text_h)/2", "bottom": "h-text_h-40"}.get(overlay.get("position"), "h-text_h-40")
            filters.append(f"drawtext=textfile={txt.name}:expansion=none:fontsize=32:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12:x=(w-text_w)/2:y={y}:enable='between(t,{overlay['start']},{overlay['end']})'")
        final = merged
        if filters:
            final = self.root / "render.mp4"
            self.ffmpeg(self.input_args(merged) + ["-vf", ",".join(filters), "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(final)])
        source_path = self.upload(final, "render.mp4", "source")
        info = self.probe(final)
        return {**self.transcode(final, info), "sourcePath": source_path, "thumbnailPath": self.poster(final, info), "rendered": True}

    def execute(self):
        kind = self.s["kind"]
        if kind == "import":
            u = urllib.parse.urlsplit(self.p["downloadUrl"])
            if u.scheme != "https" or not u.hostname.endswith(".cloudflarestream.com"):
                raise ProcessorError("INVALID_STREAM_HOST")
            f = self.download(self.p["downloadUrl"], self.root / "import.mp4")
            info = self.probe(f)
            primary = self.upload(f, "optimized.mp4", "playback")
            return {**info, "primaryPath": primary, "sourcePath": primary, "kind": "mp4", "thumbnailPath": self.poster(f, info), "streamExport": True}
        if kind == "capture":
            # HTTPS bounded file ingestion; camera/screen live input comes from browser MediaRecorder.
            # Raw RTSP is intentionally rejected until a hardened egress-policy adapter is configured.
            u = urllib.parse.urlsplit(self.p["captureUrl"])
            if u.scheme != "https":
                raise ProcessorError("RTSP_REQUIRES_HARDENED_EGRESS_ADAPTER_NOT_SHIPPED")
            src = self.download(self.p["captureUrl"], self.root / "capture-source.mp4")
            info = self.probe(src)
            out = self.root / "capture.mp4"
            self.ffmpeg(self.input_args(src) + ["-t", str(min(info["durationSeconds"], self.p.get("captureSeconds", 60))), "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-movflags", "+faststart", str(out)])
            info = self.probe(out)
            source_path = self.upload(out, "capture.mp4", "source")
            return {**self.transcode(out, info), "sourcePath": source_path, "thumbnailPath": self.poster(out, info)}
        for i, s in enumerate(self.s.get("sources", [])):
            # Only job-scoped callback URLs for known same-tenant source IDs.
            if not s["url"].startswith(self.base + "/source/" + self.id + "/"):
                raise ProcessorError("SOURCE_CAPABILITY_MISMATCH")
            suffix = Path(s.get("path", "source.mp4")).suffix
            if suffix not in (".mp4", ".mov", ".webm", ".wav", ".mp3", ".m4a", ".jpg", ".png"):
                raise ProcessorError("SOURCE_TYPE_UNSUPPORTED")
            self.sources[s["id"]] = self.download(s["url"], self.root / f"source-{i}{suffix}")
        if kind == "render":
            return self.render()
        source = next(iter(self.sources.values()))
        info = self.probe(source)
        if kind == "probe":
            return {**info, "thumbnailPath": self.poster(source, info)}
        if kind == "transcode":
            source = self.branding_source(source, info)
            return {**self.transcode(source, info), "thumbnailPath": self.poster(source, info)}
        if kind == "preview":
            return self.preview(source, info)
        if kind == "export":
            source = self.branding_source(source, info) if info["hasVideo"] else source
            return self.export_media(source, info)
        if kind == "index":
            return self.extract_index(source, info)
        raise ProcessorError("UNKNOWN_PROCESSOR_KIND")

    def run(self):
        try:
            result = self.execute()
            return {"state": "done", "result": result, "wallSeconds": time.monotonic()-self.started,
                    "cpuSeconds": cpu_seconds()-self.cpu_start, "uploadedBytes": self.uploaded,
                    "downloadedBytes": self.downloaded}
        except Exception as exc:
            return {"state": "failed", "error": str(exc)[:200] if isinstance(exc, ProcessorError) else type(exc).__name__,
                    "wallSeconds": time.monotonic()-self.started, "cpuSeconds": cpu_seconds()-self.cpu_start,
                    "uploadedBytes": self.uploaded, "downloadedBytes": self.downloaded}
        finally:
            shutil.rmtree(self.root, ignore_errors=True)

def work(spec):
    global STATUS
    def publish(value):
        with LOCK:
            if STATUS.get("id") == spec["id"]:
                STATUS["progress"] = value
                STATUS.setdefault("diagnostics", {})["stage"] = value["stage"]
    job = Job(spec, progress=publish)
    def diagnose(value):
        with LOCK:
            STATUS["diagnostics"] = {**value, "updatedAt": round(time.time()*1000)}
    job.diagnostic_callback = diagnose
    result = job.run()
    result["diagnostics"] = {**job.diagnostics, "processorRelease": os.environ.get("PROCESSOR_RELEASE", "local")}
    with LOCK:
        STATUS = {"id": spec["id"], **result}

class Handler(http.server.BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def log_message(self, *_):
        pass  # access URLs include sensitive job capabilities
    def send(self, value, status=200):
        raw = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        if self.path == "/health":
            self.send({"ok": True, "processorRelease": os.environ.get("PROCESSOR_RELEASE", "local")})
        elif self.path == "/status":
            with LOCK:
                snapshot = copy.deepcopy(STATUS)
            self.send(snapshot)
        else:
            self.send({"error": "NOT_FOUND"}, 404)
    def do_POST(self):
        global STATUS
        if self.path != "/run":
            return self.send({"error": "NOT_FOUND"}, 404)
        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= 128 * 1024:
            return self.send({"error": "BODY_TOO_LARGE"}, 413)
        try:
            spec = json.loads(self.rfile.read(length))
            with LOCK:
                existing = STATUS.get("id")
                if not existing:
                    STATUS = {"id": spec["id"], "state": "running"}
            if existing and existing != spec["id"]:
                return self.send({"error": "CONTAINER_BUSY"}, 409)
            if not existing:
                POOL.submit(work, spec)
            self.send({"accepted": True, "id": spec["id"]}, 202)
        except (KeyError, TypeError, ValueError):
            self.send({"error": "INVALID_JOB"}, 400)

if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
