"""이제 나도 발표왕 — 발표 태도 분석 및 피드백 프로그램 진입점"""

import sys
import os

# 현재 디렉토리를 경로에 추가 (모듈 import 해결)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import tkinter as tk

def check_dependencies():
    missing = []
    packages = {
        "cv2": "opencv-python",
        "mediapipe": "mediapipe",
        "PIL": "Pillow",
        "pyaudio": "pyaudio",
        "speech_recognition": "SpeechRecognition",
        "matplotlib": "matplotlib",
        "numpy": "numpy",
    }
    for module, pkg in packages.items():
        try:
            __import__(module)
        except ImportError:
            missing.append(pkg)
    return missing


def show_install_guide(missing: list[str]):
    root = tk.Tk()
    root.title("패키지 설치 필요")
    root.geometry("500x300")
    root.configure(bg="#1a1a2e")

    tk.Label(root, text="다음 패키지가 설치되어 있지 않습니다:",
             font=("Malgun Gothic", 13, "bold"),
             fg="white", bg="#1a1a2e").pack(pady=(30, 10))

    for pkg in missing:
        tk.Label(root, text=f"  • {pkg}",
                 font=("Malgun Gothic", 11),
                 fg="#e94560", bg="#1a1a2e").pack(anchor="w", padx=60)

    tk.Label(root, text="\n아래 명령어로 설치하세요:",
             font=("Malgun Gothic", 11),
             fg="#a8a8b3", bg="#1a1a2e").pack()

    cmd = "pip install " + " ".join(missing)
    tk.Label(root, text=cmd,
             font=("Courier New", 10),
             fg="#00ff88", bg="#16213e",
             padx=12, pady=8).pack(pady=6, padx=40, fill="x")

    tk.Button(root, text="확인", command=root.destroy,
              font=("Malgun Gothic", 11),
              fg="white", bg="#e94560",
              relief="flat", padx=20, pady=6).pack(pady=16)

    root.mainloop()


def main():
    missing = check_dependencies()
    if missing:
        show_install_guide(missing)
        sys.exit(1)

    from gui.app import PresentationApp

    root = tk.Tk()
    PresentationApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
