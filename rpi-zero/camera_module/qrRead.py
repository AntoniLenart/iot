#!/usr/bin/env python3
"""
camera_module.py

Driver for RaspberryPi Camera.
Works on Raspberry Pi Zero.
"""
import os
import cv2
import time
import json
from datetime import datetime
from pyzbar import pyzbar
from picamera2 import Picamera2
import threading

class CameraModule:
    def __init__(self, picam):
        self.picam = picam
        self.is_started = True
        self.qr_result = None
        self.qr_event = threading.Event()
        self._stop_event = threading.Event()
        self._thread = None
        print("Camera ready for scanning.")

    def qr_to_json(self, qr_text: str) -> dict:
        return {
            "type": "qr",
            "data": qr_text,
        }

    def cleanup(self):
        print("Cleaning up camera...")
        if self.picam:
            if self.is_started:
                self.picam.stop()
                self.is_started = False
            self.picam.close()
            self.picam = None
        print("Camera shutdown complete.")

    def live_scan(self, save_dir: str = None, timeout: int = 0):
        if not self.is_started:
            raise RuntimeError("Camera not started")

        if save_dir is not None:
            os.makedirs(save_dir, exist_ok=True)
            print("[INFO] Starting live QR scan...")
        
        start_time = time.time()

        try:
            while not self._stop_event.is_set():
                frame = self.picam.capture_array()
                frame_gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
                qr_codes = pyzbar.decode(frame_gray)

                if qr_codes:  # stop at the first detected QR
                    qr = qr_codes[0]
                    data_bytes = qr.data
                    data_text = data_bytes.decode("utf-8", errors="ignore")
                    (x, y, w, h) = qr.rect

                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

                    if save_dir is not None:
                        # Save cropped QR image
                        crop = frame_gray[y:y + h, x:x + w]
                        img_path = os.path.join(save_dir, f"qr_{timestamp}.jpg")
                        cv2.imwrite(img_path, crop)

                    # Convert to JSON
                    qr_json = self.qr_to_json(data_text)
                    if save_dir is not None:
                        json_path = os.path.join(save_dir, f"qr_{timestamp}.json")
                        with open(json_path, "w", encoding="utf-8") as f:
                            json.dump(qr_json, f, indent=2)

                    # print(f"[INFO] QR detected: {data_text}")
                    if save_dir is not None:
                        print(f"[INFO] Saved image: {img_path}")
                        print(f"[INFO] Saved JSON:  {json_path}")

                    self.qr_result = data_text
                    self.qr_event.set()
                    return
                
                time.sleep(0.05)

        except Exception:
            pass
        finally:
            print("QR scanning thread exiting.")

    def start_background_scan(self, **kwargs):
        if self._thread and self._thread.is_alive():
            print("Scan already running.")
            return
        self._stop_event.clear()
        self.qr_event.clear()
        self._thread = threading.Thread(target=self.live_scan, kwargs=kwargs, daemon=True)
        self._thread.start()

    def stop_scan(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join()
            print("Background QR scan stopped.")

if __name__ == "__main__":
    print("Initializing camera...")
    picam = Picamera2()
    config = picam.create_video_configuration(
        main={"size": (1200, 1800), "format": "RGB888"}, buffer_count=2,
        controls={"FrameRate": 5.0}
    )
    picam.configure(config)
    picam.start()

    cam = CameraModule(picam)
    cam.start_background_scan()

    print("Show qr code to camer in order to read data...")
    while True:
        if cam.qr_event.wait(timeout=5):
            print("QR code detected!")
            print(f"QR Data: \n {cam.qr_result}")
            cam.stop_scan()
            cam.cleanup()
            break
        else:
            print("Waiting for QR code...")
           


