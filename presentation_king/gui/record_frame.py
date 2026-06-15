import tkinter as tk
import threading
import time
import wave
import tempfile
import os

import cv2
import pyaudio
from PIL import Image, ImageTk

from analyzers.gaze_analyzer import GazeAnalyzer
from config import COLORS


class RecordFrame(tk.Frame):
    AUDIO_RATE = 16000
    AUDIO_CHUNK = 1024
    PREVIEW_FPS = 30

    def __init__(self, parent, app):
        super().__init__(parent, bg=COLORS["bg_dark"])
        self.app = app

        self._recording = False
        self._start_time: float = 0.0
        self._audio_frames: list[bytes] = []
        self._temp_audio: str = ""

        self._cap: cv2.VideoCapture | None = None
        self._gaze = GazeAnalyzer()
        self._preview_job: str | None = None
        self._timer_job: str | None = None

        self._build()
        self._init_camera()

    # ── UI 구성 ───────────────────────────────────────────────

    def _build(self):
        # 상단 바
        top = tk.Frame(self, bg=COLORS["bg_card"], pady=8)
        top.pack(fill="x")

        tk.Button(top, text="← 홈으로", font=("Malgun Gothic", 11),
                  fg=COLORS["text_muted"], bg=COLORS["bg_card"],
                  relief="flat", cursor="hand2",
                  command=self._go_home).pack(side="left", padx=20)

        tk.Label(top, text="발표 연습", font=("Malgun Gothic", 16, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_card"]).pack(side="left", padx=10)

        self._timer_lbl = tk.Label(top, text="00:00",
                                   font=("Malgun Gothic", 18, "bold"),
                                   fg=COLORS["accent"], bg=COLORS["bg_card"])
        self._timer_lbl.pack(side="right", padx=30)

        # 본문
        body = tk.Frame(self, bg=COLORS["bg_dark"])
        body.pack(fill="both", expand=True, padx=16, pady=12)

        # 카메라 영역
        cam_wrapper = tk.Frame(body, bg=COLORS["bg_card"], bd=2, relief="flat")
        cam_wrapper.pack(side="left", fill="both", expand=True, padx=(0, 10))

        self._cam_lbl = tk.Label(cam_wrapper, text="카메라 준비 중...",
                                 font=("Malgun Gothic", 13),
                                 fg=COLORS["text_muted"], bg=COLORS["bg_card"])
        self._cam_lbl.pack(fill="both", expand=True)

        # 오른쪽 패널
        right = tk.Frame(body, bg=COLORS["bg_dark"], width=220)
        right.pack(side="right", fill="y")
        right.pack_propagate(False)

        self._gaze_card(right)
        self._stats_card(right)
        self._guide_card(right)

        # 버튼 영역
        btn_area = tk.Frame(self, bg=COLORS["bg_dark"])
        btn_area.pack(fill="x", padx=16, pady=10)

        self._start_btn = tk.Button(
            btn_area, text="  녹화 시작  ",
            font=("Malgun Gothic", 14, "bold"),
            fg="white", bg=COLORS["accent"],
            activebackground="#c73652",
            relief="flat", cursor="hand2",
            padx=18, pady=9,
            command=self._start,
        )
        self._start_btn.pack(side="left", padx=5)

        self._stop_btn = tk.Button(
            btn_area, text="  녹화 종료 및 분석  ",
            font=("Malgun Gothic", 14, "bold"),
            fg="white", bg=COLORS["bg_btn"],
            activebackground="#0a2744",
            relief="flat", cursor="hand2",
            padx=18, pady=9,
            state="disabled",
            command=self._stop,
        )
        self._stop_btn.pack(side="left", padx=5)

        self._status_lbl = tk.Label(
            self, text="녹화 시작 버튼을 눌러 발표를 시작하세요.",
            font=("Malgun Gothic", 11),
            fg=COLORS["text_muted"], bg=COLORS["bg_dark"],
        )
        self._status_lbl.pack(pady=4)

    def _gaze_card(self, parent):
        card = tk.Frame(parent, bg=COLORS["bg_card"])
        card.pack(fill="x", pady=(0, 8))

        tk.Label(card, text="시선 방향", font=("Malgun Gothic", 11, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_card"]).pack(pady=(12, 4))

        self._gaze_lbl = tk.Label(card, text="대기 중",
                                  font=("Malgun Gothic", 22, "bold"),
                                  fg=COLORS["text_muted"], bg=COLORS["bg_card"])
        self._gaze_lbl.pack(pady=(0, 12))

    def _stats_card(self, parent):
        card = tk.Frame(parent, bg=COLORS["bg_card"])
        card.pack(fill="x", pady=(0, 8))

        tk.Label(card, text="실시간 통계", font=("Malgun Gothic", 11, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_card"]).pack(pady=(12, 4))

        self._fwd_lbl = tk.Label(card, text="정면 응시: 0%",
                                 font=("Malgun Gothic", 11),
                                 fg=COLORS["text_muted"], bg=COLORS["bg_card"])
        self._fwd_lbl.pack(pady=(0, 12))

    def _guide_card(self, parent):
        card = tk.Frame(parent, bg=COLORS["bg_card"])
        card.pack(fill="x")

        tk.Label(card, text="안내", font=("Malgun Gothic", 11, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_card"]).pack(pady=(12, 4))

        guides = [
            "• 카메라를 정면으로 바라보세요",
            "• 마이크를 확인해 주세요",
            "• 발표하듯이 말씀하세요",
            "• 최소 30초 이상 녹화\n  하시면 정확합니다",
            "• 음성 인식은 인터넷이\n  필요합니다",
        ]
        for g in guides:
            tk.Label(card, text=g, font=("Malgun Gothic", 9),
                     fg=COLORS["text_muted"], bg=COLORS["bg_card"],
                     justify="left").pack(anchor="w", padx=12, pady=2)
        tk.Frame(card, bg=COLORS["bg_card"], height=10).pack()

    # ── 카메라 ────────────────────────────────────────────────

    def _init_camera(self):
        self._cap = cv2.VideoCapture(0)
        if self._cap.isOpened():
            self._status_lbl.config(text="카메라 연결됨. 녹화 시작 버튼을 눌러주세요.")
        else:
            self._status_lbl.config(text="카메라를 찾을 수 없습니다.")
        self._schedule_preview()

    def _schedule_preview(self):
        self._preview_job = self.after(1000 // self.PREVIEW_FPS, self._preview_tick)

    def _preview_tick(self):
        if not self._cap or not self._cap.isOpened():
            self._schedule_preview()
            return

        ret, frame = self._cap.read()
        if ret:
            if self._recording:
                gaze, frame = self._gaze.analyze_frame(frame)
                if gaze:
                    self._update_gaze_ui(gaze)

            frame = cv2.flip(frame, 1)
            h, w = frame.shape[:2]
            new_w = 620
            new_h = int(h * new_w / w)
            frame = cv2.resize(frame, (new_w, new_h))
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = ImageTk.PhotoImage(Image.fromarray(rgb))
            self._cam_lbl.config(image=img, text="")
            self._cam_lbl.image = img

        self._schedule_preview()

    def _update_gaze_ui(self, gaze: str):
        labels = {"forward": "정면 👁", "left": "왼쪽 ←",
                  "right": "오른쪽 →", "up": "위 ↑", "down": "아래 ↓"}
        colors = {"forward": COLORS["success"], "left": COLORS["warning"],
                  "right": COLORS["warning"], "up": "#ffff44", "down": COLORS["accent"]}
        self._gaze_lbl.config(text=labels.get(gaze, ""), fg=colors.get(gaze, "white"))

        stats = self._gaze.get_statistics()
        self._fwd_lbl.config(text=f"정면 응시: {stats.get('forward_percent', 0)}%")

    # ── 녹화 제어 ─────────────────────────────────────────────

    def _start(self):
        self._recording = True
        self._start_time = time.time()
        self._audio_frames.clear()
        self._gaze.reset()

        self._start_btn.config(state="disabled", bg="#555555")
        self._stop_btn.config(state="normal", bg=COLORS["accent"])
        self._status_lbl.config(text="🔴 녹화 중 — 발표를 시작하세요!", fg=COLORS["accent"])

        threading.Thread(target=self._audio_worker, daemon=True).start()
        self._tick_timer()

    def _tick_timer(self):
        if not self._recording:
            return
        elapsed = time.time() - self._start_time
        m, s = divmod(int(elapsed), 60)
        self._timer_lbl.config(text=f"{m:02d}:{s:02d}")
        self._timer_job = self.after(1000, self._tick_timer)

    def _audio_worker(self):
        p = pyaudio.PyAudio()
        try:
            stream = p.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=self.AUDIO_RATE,
                input=True,
                frames_per_buffer=self.AUDIO_CHUNK,
            )
            while self._recording:
                try:
                    data = stream.read(self.AUDIO_CHUNK, exception_on_overflow=False)
                    self._audio_frames.append(data)
                except Exception:
                    pass
            stream.stop_stream()
            stream.close()
        finally:
            p.terminate()

    def _stop(self):
        self._recording = False
        duration = time.time() - self._start_time

        if self._timer_job:
            self.after_cancel(self._timer_job)

        self._stop_btn.config(state="disabled")
        self._start_btn.config(state="disabled")
        self._status_lbl.config(text="분석 중... 잠시 기다려주세요 ⏳", fg=COLORS["warning"])

        # 오디오 WAV 저장
        self._temp_audio = tempfile.mktemp(suffix=".wav")
        p = pyaudio.PyAudio()
        with wave.open(self._temp_audio, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(p.get_sample_size(pyaudio.paInt16))
            wf.setframerate(self.AUDIO_RATE)
            wf.writeframes(b"".join(self._audio_frames))
        p.terminate()

        threading.Thread(target=self._run_analysis, args=(duration,), daemon=True).start()

    def _run_analysis(self, duration: float):
        from analyzers.speech_analyzer import SpeechAnalyzer
        from analyzers.voice_analyzer import VoiceAnalyzer
        from config import SCORE_WEIGHTS

        gaze_stats = self._gaze.get_statistics()

        self.after(0, lambda: self._status_lbl.config(text="목소리 분석 중..."))
        voice_stats = VoiceAnalyzer().analyze(self._temp_audio)

        self.after(0, lambda: self._status_lbl.config(
            text="음성 인식 중... (인터넷 연결이 필요합니다)"))
        speech_stats = SpeechAnalyzer().analyze_audio(self._temp_audio, duration)

        try:
            os.remove(self._temp_audio)
        except Exception:
            pass

        overall = round(
            gaze_stats.get("score", 50) * SCORE_WEIGHTS["gaze"]
            + speech_stats.get("speech_score", 50) * SCORE_WEIGHTS["speech_speed"]
            + speech_stats.get("filler_score", 50) * SCORE_WEIGHTS["filler"]
            + voice_stats.get("stability_score", 50) * SCORE_WEIGHTS["voice"]
        )

        results = {
            "duration": duration,
            "gaze": gaze_stats,
            "speech": speech_stats,
            "voice": voice_stats,
            "overall_score": overall,
        }

        if self._cap:
            self._cap.release()
        if self._preview_job:
            self.after_cancel(self._preview_job)

        self.after(0, lambda: self.app.show_result(results))

    # ── 내비게이션 ────────────────────────────────────────────

    def _go_home(self):
        self._recording = False
        self._cleanup()
        self.app.show_home()

    def _cleanup(self):
        if self._preview_job:
            self.after_cancel(self._preview_job)
        if self._timer_job:
            self.after_cancel(self._timer_job)
        if self._cap:
            self._cap.release()

    def destroy(self):
        self._recording = False
        self._cleanup()
        super().destroy()
