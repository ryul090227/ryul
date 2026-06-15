import tkinter as tk
from tkinter import ttk

import matplotlib
import matplotlib.font_manager as fm
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

from config import COLORS
from utils.session_manager import load_sessions

_KO_FONTS = ["Malgun Gothic", "AppleGothic", "NanumGothic", "UnDotum"]
_avail = {f.name for f in fm.fontManager.ttflist}
for _f in _KO_FONTS:
    if _f in _avail:
        matplotlib.rc("font", family=_f)
        break
matplotlib.rcParams["axes.unicode_minus"] = False


class HistoryFrame(tk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, bg=COLORS["bg_dark"])
        self.app = app
        self.sessions = load_sessions()
        self._build()

    def _build(self):
        # 상단 바
        top = tk.Frame(self, bg=COLORS["bg_card"], pady=8)
        top.pack(fill="x")

        tk.Button(top, text="← 홈으로", font=("Malgun Gothic", 11),
                  fg=COLORS["text_muted"], bg=COLORS["bg_card"],
                  relief="flat", cursor="hand2",
                  command=self.app.show_home).pack(side="left", padx=20)

        tk.Label(top, text="연습 기록", font=("Malgun Gothic", 16, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_card"]).pack(side="left", padx=10)

        if not self.sessions:
            tk.Label(self,
                     text="아직 연습 기록이 없습니다.\n발표 연습을 시작해보세요! 💪",
                     font=("Malgun Gothic", 14),
                     fg=COLORS["text_muted"], bg=COLORS["bg_dark"]).pack(expand=True)
            return

        # 스크롤 영역
        outer = tk.Frame(self, bg=COLORS["bg_dark"])
        outer.pack(fill="both", expand=True)

        canvas = tk.Canvas(outer, bg=COLORS["bg_dark"], highlightthickness=0)
        sb = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        sf = tk.Frame(canvas, bg=COLORS["bg_dark"])

        sf.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=sf, anchor="nw")
        canvas.configure(yscrollcommand=sb.set)
        canvas.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        canvas.bind_all("<MouseWheel>",
                        lambda e: canvas.yview_scroll(-1 * (e.delta // 120), "units"))

        self._summary_section(sf)
        self._trend_chart(sf)
        self._session_list(sf)

    def _summary_section(self, parent):
        f = tk.Frame(parent, bg=COLORS["bg_card"])
        f.pack(fill="x", padx=24, pady=(20, 8))

        total = len(self.sessions)
        best = max(s["overall_score"] for s in self.sessions)
        avg = round(sum(s["overall_score"] for s in self.sessions) / total)

        tk.Label(f, text=f"총 {total}회 연습",
                 font=("Malgun Gothic", 13, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_card"]).pack(side="left", padx=24, pady=14)

        tk.Label(f, text=f"최고 점수: {best}점",
                 font=("Malgun Gothic", 12),
                 fg=COLORS["success"], bg=COLORS["bg_card"]).pack(side="left", padx=24)

        tk.Label(f, text=f"평균 점수: {avg}점",
                 font=("Malgun Gothic", 12),
                 fg=COLORS["warning"], bg=COLORS["bg_card"]).pack(side="left", padx=24)

        if total > 1:
            diff = self.sessions[-1]["overall_score"] - self.sessions[0]["overall_score"]
            trend_c = COLORS["success"] if diff > 0 else COLORS["accent"] if diff < 0 else COLORS["text_muted"]
            trend_t = (f"▲ {diff}점 향상" if diff > 0
                       else f"▼ {abs(diff)}점 하락" if diff < 0 else "변화 없음")
            tk.Label(f, text=f"처음 대비: {trend_t}",
                     font=("Malgun Gothic", 12, "bold"),
                     fg=trend_c, bg=COLORS["bg_card"]).pack(side="right", padx=24)

    def _trend_chart(self, parent):
        if len(self.sessions) < 2:
            return

        f = tk.Frame(parent, bg=COLORS["bg_dark"])
        f.pack(fill="x", padx=24, pady=8)

        tk.Label(f, text="점수 추이", font=("Malgun Gothic", 12, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_dark"]).pack(anchor="w", pady=(8, 4))

        fig = Figure(figsize=(9, 2.5), facecolor=COLORS["bg_card"])
        ax = fig.add_subplot(111)
        ax.set_facecolor(COLORS["bg_card"])
        for sp in ax.spines.values():
            sp.set_color("#444466")
        ax.tick_params(colors="white")

        xs = list(range(1, len(self.sessions) + 1))
        ys = [s["overall_score"] for s in self.sessions]

        ax.plot(xs, ys, color=COLORS["accent"], linewidth=2, marker="o",
                markersize=5, markerfacecolor=COLORS["success"])
        ax.fill_between(xs, ys, alpha=0.15, color=COLORS["accent"])
        ax.set_xlim(0.5, len(xs) + 0.5)
        ax.set_ylim(0, 105)
        ax.set_xlabel("회차", color="white", fontsize=9)
        ax.set_ylabel("점수", color="white", fontsize=9)
        ax.set_title("종합 점수 변화", color="white", fontsize=11)
        ax.grid(color="#333355", linestyle="--", alpha=0.4)

        fig.tight_layout(pad=1.5)
        FigureCanvasTkAgg(fig, master=f).get_tk_widget().pack(fill="x")
        FigureCanvasTkAgg(fig, master=f).draw()

    def _session_list(self, parent):
        f = tk.Frame(parent, bg=COLORS["bg_dark"])
        f.pack(fill="x", padx=24, pady=8)

        tk.Label(f, text="전체 기록", font=("Malgun Gothic", 12, "bold"),
                 fg=COLORS["text"], bg=COLORS["bg_dark"]).pack(anchor="w", pady=(8, 4))

        for i, session in enumerate(reversed(self.sessions), 1):
            score = session.get("overall_score", 0)
            sc = (COLORS["accent"] if score < 60
                  else COLORS["warning"] if score < 80
                  else COLORS["success"])

            card = tk.Frame(f, bg=COLORS["bg_card"])
            card.pack(fill="x", pady=4)

            # 회차 + 날짜
            left = tk.Frame(card, bg=COLORS["bg_card"])
            left.pack(side="left", padx=16, pady=10)
            tk.Label(left, text=f"#{len(self.sessions) - i + 1}",
                     font=("Malgun Gothic", 10),
                     fg=COLORS["text_muted"], bg=COLORS["bg_card"]).pack(anchor="w")
            tk.Label(left, text=session.get("date", ""),
                     font=("Malgun Gothic", 11),
                     fg=COLORS["text"], bg=COLORS["bg_card"]).pack(anchor="w")

            # 미니 통계
            mid = tk.Frame(card, bg=COLORS["bg_card"])
            mid.pack(side="left", padx=10, pady=10, fill="x", expand=True)

            dur = session.get("duration", 0)
            m, s = divmod(int(dur), 60)
            info = (f"발표 시간 {m}분{s}초  |  "
                    f"정면응시 {session.get('forward_percent', 0)}%  |  "
                    f"말속도 {session.get('wpm', 0)}WPM  |  "
                    f"말버릇 {session.get('filler_count', 0)}회")
            tk.Label(mid, text=info, font=("Malgun Gothic", 9),
                     fg=COLORS["text_muted"], bg=COLORS["bg_card"]).pack(anchor="w")

            # 점수
            tk.Label(card, text=f"{score}점",
                     font=("Malgun Gothic", 16, "bold"),
                     fg=sc, bg=COLORS["bg_card"]).pack(side="right", padx=20)
