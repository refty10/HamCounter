import threading
import requests
from gpiozero import DigitalInputDevice
from datetime import datetime, timedelta, timezone

# 定数の定義
WHEEL_CIRCUMFERENCE = 42.5 / 100  # 滑車の円周 (m)
NO_CHANGE_TIMEOUT = 1.5  # 中断とみなす時間 (秒)
API_URL = "http://192.168.1.8:8000/run"  # REST APIエンドポイント
JST = timezone(timedelta(hours=9))  # 日本時間

# デバイスの初期化
photo_reflector = DigitalInputDevice(13)  # GPIO13に接続されたフォトリフレクタ
# 状態管理
previous_state = None  # センサの前回の状態
last_change_time = datetime.now(JST)  # 前回の状態変化の時刻
running = True  # タイマーの実行フラグ


class Run:
    """1回転分の走行状態を管理するクラス"""

    def __init__(self, wheel_circumference):
        self.wheel_circumference = wheel_circumference
        self.start_time = None
        self.run_in_progress = False

    def start_run(self):
        """走行を開始"""
        self.start_time = datetime.now(JST)
        self.run_in_progress = True
        print(f"Run started at: {self.start_time.isoformat()}")

    def end_run(self):
        """走行を終了し、データを返す"""
        end_time = datetime.now(JST)
        duration = (end_time - self.start_time).total_seconds()
        speed = self.wheel_circumference / duration * 3.6  # km/h
        self.run_in_progress = False
        print(
            f"Run ended at: {end_time.isoformat()}, Duration: {duration:.2f}s, Speed: {speed:.2f} km/h"
        )
        return {
            "from": self.start_time.isoformat(),
            "to": end_time.isoformat(),
            "seconds": duration,
            "speed": speed,
        }

    def reset_run(self):
        """走行中断処理"""
        print("Run interrupted. Resetting state.")
        self.start_time = None
        self.run_in_progress = False


def send_run_data(data):
    """走行データをREST APIに送信"""
    try:
        response = requests.post(API_URL, json=data)
        response.raise_for_status()
        print(f"Data sent successfully: {data}")
    except requests.exceptions.RequestException as e:
        print(f"Failed to send data: {e}")


def monitor_sensor(run):
    """
    フォトリフレクタを監視し、1回転の検出と走行管理を行う。
    """
    global previous_state, last_change_time, running

    if not running:
        return  # 実行フラグがFalseなら監視を停止

    current_state = photo_reflector.value  # 現在のセンサ値
    current_time = datetime.now(JST)

    # 磁石通過を検出 (1 → 0 の変化)
    if previous_state == 1 and current_state == 0:
        if run.run_in_progress:
            # 現在の走行を終了して次の走行を開始
            data = run.end_run()
            send_run_data(data)
        run.start_run()  # 新しい走行を開始
        last_change_time = current_time  # 状態変化の時刻を更新

    # 走行中断の判定
    if (
        run.run_in_progress
        and (current_time - last_change_time).total_seconds() > NO_CHANGE_TIMEOUT
    ):
        run.reset_run()

    previous_state = current_state  # 状態を更新

    # 次回の監視をスケジュール
    threading.Timer(0.001, monitor_sensor, args=(run,)).start()  # 1ms間隔で再実行


def stop_monitoring():
    """センサ監視を停止し、LEDをオフにする。"""
    global running
    running = False
    print("Monitoring stopped. Server shutting down...")


if __name__ == "__main__":
    run = Run(WHEEL_CIRCUMFERENCE)  # Runクラスのインスタンスを作成
    print("Monitoring sensor... Press Ctrl+C to stop.")

    try:
        # センサ監視を開始
        threading.Timer(0.001, monitor_sensor, args=(run,)).start()
        while True:
            pass  # メインスレッドを維持
    except KeyboardInterrupt:
        stop_monitoring()
