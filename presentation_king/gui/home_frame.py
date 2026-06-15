import tkinter as tk
from config import COLORS


class HomeFrame(tk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, bg=COLORS["bg_dark"])
        self.app = app
        self._build()

    def _build(self):
        # ── 헤더 ──────────────────────────────────────────────
        header = tk.Frame(self, bg=COLORS["bg_card"], pady=0)
        header.pack(fill="x")

        tk.Label(
            header,
            text="이제 나도 발표왕 👑",
            font=("Malgun Gothic", 30, "bold"),
            fg=COLORS["accent"],
            bg=COLORS["bg_card"],
            pady=22,
        ).pack()

        tk.Label(
            header,
            text="발표 태도 분석 및 피드백을 통한 발표 태도 개선 프로그램",
            font=("Malgun Gothic", 12),
            fg=COLORS["text_muted"],
            bg=COLORS["bg_card"],
            pady=6,
        ).pack()

        # ── 기능 소개 카드 ──────────────────────────────────
        features_outer = tk.Frame(self, bg=COLORS["bg_dark"])
        features_outer.pack(fill="both", expand=True, padx=50, pady=30)

        tk.Label(
            features_outer,
            text="분석 항목",
            font=("Malgun Gothic", 15, "bold"),
            fg=COLORS["text"],
            bg=COLORS["bg_dark"],
        ).pack(pady=(0, 18))

        grid = tk.Frame(features_outer, bg=COLORS["bg_dark"])
        grid.pack()

        features = [
            ("👁", "시선 처리 분석", "정면 응시 비율 및\n시선 방향 분포 측정"),
            ("🎙", "말 속도 분석", "분당 어절 수 측정 및\n적정 속도 평가"),
            ("💬", "말버릇 분석", "'아', '음', '어' 등\n불필요한 표현 횟수 측정"),
            ("📊", "목소리 안정성", "목소리 떨림 및\n안정성 분석"),
        ]

        for i, (icon, title, desc) in enumerate(features):
            card = tk.Frame(grid, bg=COLORS["bg_card"], width=180, height=150)
            card.grid(row=i // 2, column=i % 2, padx=12, pady=12)
            card.pack_propagate(False)

            tk.Label(card, text=icon, font=("", 26), bg=COLORS["bg_card"],
                     fg=COLORS["accent"]).pack(pady=(18, 4))
            tk.Label(card, text=title, font=("Malgun Gothic", 11, "bold"),
                     fg=COLORS["text"], bg=COLORS["bg_card"]).pack()
            tk.Label(card, text=desc, font=("Malgun Gothic", 9),
                     fg=COLORS["text_muted"], bg=COLORS["bg_card"],
                     justify="center").pack(pady=(3, 12))

        # ── 버튼 ───────────────────────────────────────────
        btn_area = tk.Frame(self, bg=COLORS["bg_dark"])
        btn_area.pack(pady=24)

        tk.Button(
            btn_area,
            text="  발표 연습 시작  ",
            font=("Malgun Gothic", 14, "bold"),
            fg="white", bg=COLORS["accent"],
            activebackground="#c73652",
            relief="flat", cursor="hand2",
            padx=22, pady=11,
            command=self.app.show_record,
        ).pack(side="left", padx=10)

        tk.Button(
            btn_area,
            text="  이전 기록 보기  ",
            font=("Malgun Gothic", 14),
            fg="white", bg=COLORS["bg_btn"],
            activebackground="#0a2744",
            relief="flat", cursor="hand2",
            padx=22, pady=11,
            command=self.app.show_history,
        ).pack(side="left", padx=10)
