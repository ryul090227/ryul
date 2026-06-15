import tkinter as tk

from gui.home_frame import HomeFrame
from gui.record_frame import RecordFrame
from gui.result_frame import ResultFrame
from gui.history_frame import HistoryFrame
from config import COLORS


class PresentationApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("이제 나도 발표왕 👑")
        self.root.geometry("920x700")
        self.root.configure(bg=COLORS["bg_dark"])
        self.root.resizable(False, False)

        # 화면 중앙 배치
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        self.root.geometry(f"920x700+{(sw - 920) // 2}+{(sh - 700) // 2}")

        self._container = tk.Frame(root, bg=COLORS["bg_dark"])
        self._container.pack(fill="both", expand=True)

        self.show_home()

    def _clear(self):
        for w in self._container.winfo_children():
            w.destroy()

    def show_home(self):
        self._clear()
        HomeFrame(self._container, self).pack(fill="both", expand=True)

    def show_record(self):
        self._clear()
        RecordFrame(self._container, self).pack(fill="both", expand=True)

    def show_result(self, results: dict):
        self._clear()
        ResultFrame(self._container, self, results).pack(fill="both", expand=True)

    def show_history(self):
        self._clear()
        HistoryFrame(self._container, self).pack(fill="both", expand=True)
