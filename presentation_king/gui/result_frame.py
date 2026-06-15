import tkinter as tk
from tkinter import ttk

import matplotlib
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

from config import COLORS
from utils.feedback_generator import generate_feedback
from utils.session_manager import save_session

# 한글 폰트 설정
_KO_FONTS = ["Malgun Gothic", "AppleGothic", "NanumGothic", "UnDotum", "Noto Sans CJK KR"]
_available = {f.name for f in fm.fontManager.ttflist}
for _f in _KO_FONTS:
    if _f in _available:
        matplotlib.rc("font", family=_f)
        break
matplotlib.rcParams["axes.unicode_minus"] = False


class ResultFrame(tk.Frame):
    def __init__(self, parent, app, results: dict):
        super().__init__(parent, bg=COLORS["bg_dark"])
        self.app = app
        self.results = results
        self.feedback = generate_feedback(results)
        save_session(results)
        self._build()

    # ── UI ────────────────────────────────────────────────────

    def _build(self):
        # 상단 바
        top = tk.Frame(self, bg=COLORS["bg_card"], pady=8)
        top.pack(fill="x")

        tk.Button(top, text="← 홈으로", font=("Malgun Gothic", 11),
                  fg=COLORS["text_muted"], bg=COLORS["bg_card"],
                  relief="flat", cursor="hand2",
                  command=self.app.show_home).pack(side="left", padx=20)

        tk.Label(top, text="발표 분석 결과",
                 font=("Malgun Gothic", 16, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_card"]).pack(side="left", padx=10)

        # 스크롤 가능 영역
        outer = tk.Frame(self, bg=COLORS["bg_dark"])
        outer.pack(fill="both", expand=True)

        canvas = tk.Canvas(outer, bg=COLORS["bg_dark"], highlightthickness=0)
        sb = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        self._scroll_frame = tk.Frame(canvas, bg=COLORS["bg_dark"])

        self._scroll_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")),
        )
        canvas.create_window((0, 0), window=self._scroll_frame, anchor="nw")
        canvas.configure(yscrollcommand=sb.set)

        canvas.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        canvas.bind_all("<MouseWheel>",
                        lambda e: canvas.yview_scroll(-1 * (e.delta // 120), "units"))

        self._section_scores()
        self._section_charts()
        self._section_feedback()
        self._section_buttons()

    # ── 점수 섹션 ─────────────────────────────────────────────

    def _section_scores(self):
        f = tk.Frame(self._scroll_frame, bg=COLORS["bg_card"])
        f.pack(fill="x", padx=24, pady=(20, 8))

        overall = self.results.get("overall_score", 0)
        color = (COLORS["accent"] if overall < 60
                 else COLORS["warning"] if overall < 80
                 else COLORS["success"])

        tk.Label(f, text="종합 점수", font=("Malgun Gothic", 13),
                 fg=COLORS["text_muted"], bg=COLORS["bg_card"]).pack(pady=(16, 2))
        tk.Label(f, text=f"{overall}점", font=("Malgun Gothic", 50, "bold"),
                 fg=color, bg=COLORS["bg_card"]).pack()

        grade = ("매우 우수 🌟" if overall >= 90 else "우수 👍" if overall >= 80
                 else "보통 📈" if overall >= 60 else "연습 필요 💪")
        tk.Label(f, text=grade, font=("Malgun Gothic", 13),
                 fg=color, bg=COLORS["bg_card"]).pack(pady=(0, 4))

        dur = self.results.get("duration", 0)
        m, s = divmod(int(dur), 60)
        tk.Label(f, text=f"발표 시간: {m}분 {s}초",
                 font=("Malgun Gothic", 11),
                 fg=COLORS["text_muted"], bg=COLORS["bg_card"]).pack(pady=(0, 12))

        # 항목별 점수 바
        cats = [
            ("👁  시선 처리", self.results.get("gaze", {}).get("score", 0)),
            ("🎙  말 속도", self.results.get("speech", {}).get("speech_score", 0)),
            ("💬  말버릇", self.results.get("speech", {}).get("filler_score", 0)),
            ("📊  목소리 안정성", self.results.get("voice", {}).get("stability_score", 0)),
        ]

        bar_wrap = tk.Frame(f, bg=COLORS["bg_card"])
        bar_wrap.pack(fill="x", padx=24, pady=(0, 16))

        for name, score in cats:
            row = tk.Frame(bar_wrap, bg=COLORS["bg_btn"])
            row.pack(fill="x", pady=3)

            tk.Label(row, text=name, font=("Malgun Gothic", 10),
                     fg=COLORS["text"], bg=COLORS["bg_btn"],
                     width=16, anchor="w").pack(side="left", padx=10, pady=7)

            bar_bg = tk.Frame(row, bg="#2a2a4a", height=12, width=260)
            bar_bg.pack(side="left", pady=7)
            bar_bg.pack_propagate(False)

            sc = (COLORS["accent"] if score < 60
                  else COLORS["warning"] if score < 80
                  else COLORS["success"])
            bar_fill = tk.Frame(bar_bg, bg=sc, height=12, width=max(int(score * 2.6), 0))
            bar_fill.place(x=0, y=0)

            tk.Label(row, text=f"{score}점", font=("Malgun Gothic", 10, "bold"),
                     fg=sc, bg=COLORS["bg_btn"], width=6).pack(side="right", padx=10)

    # ── 차트 섹션 ─────────────────────────────────────────────

    def _section_charts(self):
        f = tk.Frame(self._scroll_frame, bg=COLORS["bg_dark"])
        f.pack(fill="x", padx=24, pady=8)

        tk.Label(f, text="상세 분석", font=("Malgun Gothic", 13, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_dark"]).pack(anchor="w", pady=(8, 4))

        fig = Figure(figsize=(9, 3.6), facecolor=COLORS["bg_card"])

        # 시선 파이 차트
        gaze = self.results.get("gaze", {}).get("percentages", {})
        ax1 = fig.add_subplot(121)
        ax1.set_facecolor(COLORS["bg_card"])

        keys = ["forward", "left", "right", "up", "down"]
        labels_ko = ["정면", "왼쪽", "오른쪽", "위", "아래"]
        palette = [COLORS["success"], COLORS["warning"], COLORS["warning"],
                   "#ffff44", COLORS["accent"]]

        vals = [gaze.get(k, 0) for k in keys]
        non_zero = [(l, v, c) for l, v, c in zip(labels_ko, vals, palette) if v > 0]
        if non_zero:
            lz, vz, cz = zip(*non_zero)
            wedges, texts, atexts = ax1.pie(
                vz, labels=lz, colors=cz, autopct="%1.1f%%", startangle=90,
                textprops={"color": "white", "fontsize": 8},
            )
            for at in atexts:
                at.set_fontsize(7)
                at.set_color("white")
        ax1.set_title("시선 분포", color="white", fontsize=11)

        # 말 속도 / 말버릇 막대 차트
        speech = self.results.get("speech", {})
        ax2 = fig.add_subplot(122)
        ax2.set_facecolor(COLORS["bg_card"])
        for spine in ax2.spines.values():
            spine.set_color("#444466")
        ax2.tick_params(colors="white")

        wpm = speech.get("wpm", 0)
        filler = speech.get("filler_count", 0)
        x = np.arange(2)
        w = 0.35

        ax2.bar(x - w / 2, [wpm, filler], w, color=[COLORS["accent"], COLORS["bg_btn"]],
                label="실제", zorder=3)
        ax2.bar(x + w / 2, [150, 0], w, color=[COLORS["success"], COLORS["success"]],
                alpha=0.6, label="목표", zorder=3)
        ax2.set_xticks(x)
        ax2.set_xticklabels(["말속도(WPM)", "말버릇(회)"], color="white", fontsize=9)
        ax2.yaxis.set_tick_params(labelcolor="white")
        ax2.legend(facecolor=COLORS["bg_card"], edgecolor="#444466",
                   labelcolor="white", fontsize=8)
        ax2.set_title("말 속도 / 말버릇", color="white", fontsize=11)
        ax2.grid(axis="y", color="#333355", linestyle="--", alpha=0.5, zorder=0)

        fig.tight_layout(pad=2.0)

        canvas_w = FigureCanvasTkAgg(fig, master=f)
        canvas_w.draw()
        canvas_w.get_tk_widget().pack(fill="x")

    # ── 피드백 섹션 ───────────────────────────────────────────

    def _section_feedback(self):
        f = tk.Frame(self._scroll_frame, bg=COLORS["bg_dark"])
        f.pack(fill="x", padx=24, pady=8)

        # 상세 수치
        tk.Label(f, text="상세 수치", font=("Malgun Gothic", 13, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_dark"]).pack(anchor="w", pady=(8, 4))

        speech = self.results.get("speech", {})
        gaze = self.results.get("gaze", {})
        voice = self.results.get("voice", {})

        lines = []
        if speech and not speech.get("error"):
            lines += [
                f"  • 총 어절 수: {speech.get('word_count', 0)}어절",
                f"  • 말 속도: 분당 {speech.get('wpm', 0)}어절  (적정: 130~170)",
                f"  • 말버릇 빈도: 100어절당 {speech.get('filler_rate', 0)}회",
            ]
            fd = speech.get("filler_details", {})
            if fd:
                top = sorted(fd.items(), key=lambda x: x[1], reverse=True)[:5]
                lines.append("  • 주요 말버릇: " + ", ".join(f"'{k}'({v}회)" for k, v in top))
        elif speech.get("error"):
            lines.append(f"  • 음성 분석: {speech['error']}")

        if gaze:
            lines.append(f"  • 정면 응시 비율: {gaze.get('forward_percent', 0)}%")
        if voice and not voice.get("error"):
            lines.append(f"  • 목소리 안정성: {voice.get('stability_score', 0)}점  "
                         f"(진폭 {voice.get('amplitude_stability', 0)}점 / "
                         f"피치 {voice.get('pitch_stability', 0)}점)")

        for line in lines:
            tk.Label(f, text=line, font=("Malgun Gothic", 10),
                     fg=COLORS["text_muted"], bg=COLORS["bg_dark"],
                     anchor="w", justify="left").pack(fill="x", pady=1)

        # 피드백 목록
        tk.Label(f, text="분석 피드백", font=("Malgun Gothic", 13, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_dark"]).pack(anchor="w", pady=(18, 4))

        for i, fb in enumerate(self.feedback.get("feedbacks", []), 1):
            card = tk.Frame(f, bg=COLORS["bg_card"])
            card.pack(fill="x", pady=3)
            tk.Label(card, text=f"  {i}. {fb}", font=("Malgun Gothic", 10),
                     fg="#e8e8e8", bg=COLORS["bg_card"],
                     anchor="w", justify="left", wraplength=780).pack(
                         padx=12, pady=9, anchor="w")

        # 개선 팁
        tips = self.feedback.get("tips", [])
        if tips:
            tk.Label(f, text="개선 팁 💡", font=("Malgun Gothic", 13, "bold"),
                     fg=COLORS["success"], bg=COLORS["bg_dark"]).pack(
                         anchor="w", pady=(18, 4))

            for tip in tips:
                card = tk.Frame(f, bg=COLORS["bg_btn"])
                card.pack(fill="x", pady=3)
                tk.Label(card, text=f"  💡 {tip}", font=("Malgun Gothic", 10),
                         fg="#e8e8e8", bg=COLORS["bg_btn"],
                         anchor="w", justify="left", wraplength=780).pack(
                             padx=12, pady=9, anchor="w")

    # ── 하단 버튼 ─────────────────────────────────────────────

    def _section_buttons(self):
        f = tk.Frame(self._scroll_frame, bg=COLORS["bg_dark"])
        f.pack(pady=24)

        tk.Button(f, text="  다시 연습하기  ",
                  font=("Malgun Gothic", 13, "bold"),
                  fg="white", bg=COLORS["accent"],
                  activebackground="#c73652",
                  relief="flat", cursor="hand2",
                  padx=16, pady=8,
                  command=self.app.show_record).pack(side="left", padx=10)

        tk.Button(f, text="  홈으로 돌아가기  ",
                  font=("Malgun Gothic", 13),
                  fg="white", bg=COLORS["bg_btn"],
                  activebackground="#0a2744",
                  relief="flat", cursor="hand2",
                  padx=16, pady=8,
                  command=self.app.show_home).pack(side="left", padx=10)
