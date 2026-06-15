import cv2
import mediapipe as mp
import numpy as np


class GazeAnalyzer:
    # MediaPipe Face Mesh 아이리스 랜드마크 인덱스
    LEFT_IRIS = [468, 469, 470, 471, 472]
    RIGHT_IRIS = [473, 474, 475, 476, 477]

    # 왼쪽 눈 외곽 랜드마크: 외각(33), 내각(133), 위(160,158), 아래(144,153)
    LEFT_EYE_OUTER = 33
    LEFT_EYE_INNER = 133
    LEFT_EYE_TOP = [160, 158]
    LEFT_EYE_BOTTOM = [144, 153]

    GAZE_LABELS_KO = {
        "forward": "정면",
        "left": "왼쪽",
        "right": "오른쪽",
        "up": "위",
        "down": "아래",
    }

    GAZE_COLORS = {
        "forward": (0, 255, 136),
        "left": (0, 165, 255),
        "right": (0, 165, 255),
        "up": (0, 255, 255),
        "down": (0, 0, 255),
    }

    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.gaze_history: list[str] = []

    def analyze_frame(self, frame: np.ndarray) -> tuple[str | None, np.ndarray]:
        """프레임 분석 후 시선 방향과 주석이 달린 프레임을 반환한다."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb)

        if not results.multi_face_landmarks:
            return None, frame

        lm = results.multi_face_landmarks[0].landmark
        h, w = frame.shape[:2]

        gaze = self._calc_gaze(lm)
        self.gaze_history.append(gaze)
        frame = self._draw(frame, lm, gaze, w, h)
        return gaze, frame

    def _calc_gaze(self, lm) -> str:
        iris_x = np.mean([lm[i].x for i in self.LEFT_IRIS])
        iris_y = np.mean([lm[i].y for i in self.LEFT_IRIS])

        eye_left_x = lm[self.LEFT_EYE_OUTER].x
        eye_right_x = lm[self.LEFT_EYE_INNER].x
        eye_top_y = min(lm[i].y for i in self.LEFT_EYE_TOP)
        eye_bot_y = max(lm[i].y for i in self.LEFT_EYE_BOTTOM)

        eye_w = abs(eye_right_x - eye_left_x)
        eye_h = abs(eye_bot_y - eye_top_y)

        h_ratio = (iris_x - eye_left_x) / eye_w if eye_w > 0.001 else 0.5
        v_ratio = (iris_y - eye_top_y) / eye_h if eye_h > 0.001 else 0.5

        if v_ratio < 0.30:
            return "up"
        if v_ratio > 0.72:
            return "down"
        if h_ratio < 0.35:
            return "left"
        if h_ratio > 0.65:
            return "right"
        return "forward"

    def _draw(self, frame: np.ndarray, lm, gaze: str, w: int, h: int) -> np.ndarray:
        color = self.GAZE_COLORS.get(gaze, (255, 255, 255))
        label = f"시선: {self.GAZE_LABELS_KO.get(gaze, '?')}"

        for idx in self.LEFT_IRIS + self.RIGHT_IRIS:
            cx = int(lm[idx].x * w)
            cy = int(lm[idx].y * h)
            cv2.circle(frame, (cx, cy), 2, color, -1)

        cv2.putText(frame, label, (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
        return frame

    def get_statistics(self) -> dict:
        if not self.gaze_history:
            return {
                "percentages": {},
                "forward_percent": 0,
                "score": 0,
                "total_frames": 0,
            }

        total = len(self.gaze_history)
        directions = ["forward", "left", "right", "up", "down"]
        counts = {d: self.gaze_history.count(d) for d in directions}
        pcts = {d: round(c / total * 100, 1) for d, c in counts.items()}
        fwd = pcts["forward"]

        if fwd >= 70:
            score = 100
        elif fwd >= 50:
            score = 70 + (fwd - 50) * 1.5
        elif fwd >= 30:
            score = 40 + (fwd - 30) * 1.5
        else:
            score = fwd * (40 / 30)

        return {
            "percentages": pcts,
            "forward_percent": fwd,
            "score": round(score),
            "total_frames": total,
        }

    def reset(self):
        self.gaze_history.clear()
