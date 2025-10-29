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

class Camera:
    def __init__(self):
        """Initialize camera."""
        self.picam = None
        self.is_started = False

        print("[INFO] Initializing camera...")
        self.picam = Picamera2()
        config = self.picam.create_video_configuration(
            main={"size": (320, 240), "format": "RGB888"}, buffer_count=2
        )
        self.picam.configure(config)
        self.picam.start()
        self.is_started = True
        time.sleep(0.5)
        print("[INFO] Camera ready for live scanning.")

    def live_scan(self, save_dir: str = "qr_output", show_preview: bool = False, timeout: int = 0):
        """
        Perform live QR scanning.
        - Detects the first QR code in the live video stream.
        - Saves cropped QR image as .jpg and its data as .json if save_dir is given.

        Args:
            save_dir (str, optional): Directory to save results (default: qr_output)
            show_preview (bool): Show live feed with detection boxes
            timeout (int): Stop scanning after N seconds (0 = unlimited)

        Returns:
            dict | None: JSON dict of the first detected QR, or None if none detected
        """
        if not self.is_started:
            raise RuntimeError("Camera not started")

        os.makedirs(save_dir, exist_ok=True)
        print("[INFO] Starting live QR scan...")
        start_time = time.time()

        try:
            while True:
                frame = self.picam.capture_array()
                frame_gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
                qr_codes = pyzbar.decode(frame_gray)

                if qr_codes:  # stop at the first detected QR
                    qr = qr_codes[0]
                    data_bytes = qr.data
                    data_text = data_bytes.decode("utf-8", errors="ignore")
                    (x, y, w, h) = qr.rect

                    if show_preview:
                        frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                        cv2.rectangle(frame_bgr, (x, y), (x + w, y + h), (0, 255, 0), 2)
                        cv2.putText(frame_bgr, data_text, (x, y - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                        cv2.imshow("Live QR Scanner", frame_bgr)
                        cv2.waitKey(1)
                        cv2.destroyAllWindows()

                    # Save cropped QR image
                    crop = frame_gray[y:y + h, x:x + w]
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    img_path = os.path.join(save_dir, f"qr_{timestamp}.jpg")
                    cv2.imwrite(img_path, crop)

                    # Convert to JSON
                    qr_json = self.qr_to_json(data_text)
                    json_path = os.path.join(save_dir, f"qr_{timestamp}.json")
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(qr_json, f, indent=2)

                    print(f"[INFO] QR detected: {data_text}")
                    print(f"[INFO] Saved image: {img_path}")
                    print(f"[INFO] Saved JSON:  {json_path}")

                    return qr_json  # stop after first QR

                # Handle preview window even if no QR detected
                if show_preview:
                    frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                    cv2.imshow("Live QR Scanner", frame_bgr)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        print("[INFO] Quit requested.")
                        break

                if timeout > 0 and (time.time() - start_time) > timeout:
                    print("[INFO] Timeout reached, stopping scan.")
                    break

        except KeyboardInterrupt:
            print("\n[INFO] Scan interrupted by user.")
        finally:
            if show_preview:
                cv2.destroyAllWindows()
        return None


    def qr_to_json(self, qr_text: str) -> dict:
        """Convert raw QR data bytes into a JSON-serializable dict."""
        return {
            "format": "qr",
            "data": qr_text,
        }

    def cleanup(self):
        """Gracefully stop and release camera."""
        print("[INFO] Cleaning up camera...")
        if self.picam:
            if self.is_started:
                self.picam.stop()
                self.is_started = False
            self.picam.close()
            self.picam = None
        print("[INFO] Camera shutdown complete.")


# -----------------------------
# CLI Interface
# -----------------------------
def print_help():
    """Display CLI help message."""
    help_text = """
Raspberry Pi QR Scanner CLI Utility
-----------------------------------
Scan and save QR codes using the Pi Camera.

Usage:
<command> [options]

Commands:
  live             Start live QR scanning (stops after first detection if without options)
  help             Show this help message
  exit             Quit the application

Options:
  --save_dir DIR   Directory to save QR images and JSON (default: qr_output)
  --preview        Show live video feed during scanning
  --timeout N      Stop live scan after N seconds (default: 0 = unlimited)
"""
    print(help_text)


def main():
    print("=" * 60)
    print("    Raspberry Pi Live QR Scanner")
    print("=" * 60)

    try:
        cam = Camera()
        print_help()

        while True:
            cmd = input("\nEnter command: ").strip().lower()
            if not cmd:
                continue

            parts = cmd.split()
            command = parts[0]
            args = parts[1:]

            if command == "help":
                print_help()

            elif command == "exit":
                print("[INFO] Exiting application...")
                break

            elif command == "live":
                show_preview = "--preview" in args
                timeout = 0

                for i, arg in enumerate(args):
                    if arg == "--timeout" and i + 1 < len(args):
                        try:
                            timeout = int(args[i + 1])
                        except ValueError:
                            print("[ERROR] Invalid timeout value.")
                            continue

                results = cam.live_scan(
                    show_preview=show_preview,
                    timeout=timeout,
                    save_dir="qr_output"
                )

                if results:
                    print(f"[INFO] QR code saved.")
                else:
                    print("[INFO] No QR codes detected.")

            else:
                print(f"[ERROR] Unknown command: {command}")
                print("Type 'help' to see available commands.")

    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user.")
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
    finally:
        if "cam" in locals():
            cam.cleanup()


if __name__ == "__main__":
    main()