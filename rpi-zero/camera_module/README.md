# Moduł kamery Raspberry Pi V2 – odczyt kodów QR

Prosty sterownik CLI w Pythonie do automatycznego wykrywania i analizy kodów QR za pomocą modułu kamery Raspberry Pi (v1/v2/v3).
Zaprojektowany do pracy na Raspberry Pi Zero, 3, 4 lub 5.

## 1. Wymagania sprzętowe

- Raspberry Pi Zero / Zero W / Zero 2 W / 3 / 4 / 5
- Moduł kamery Raspberry Pi Camera v2
- Taśma FFC dedykowana dla Pi Zero (mniejszy konektor)

## 2. Schemat połączeń elektrycznych

Podłączenie kamery do Raspberry Pi Zero wymaga odpowiedniego kierunku taśmy i właściwego portu CSI

Kamera V2 korzysta z mniejszego złącza CSI na Raspberry Pi Zero. Dlatego potrzebujemy adaptera FFC do wersji Zero.

## 3. Sprawdź interfejs kamery
Po zamontowaniu kamery i uruchomieniu sprawdź, czy kamera jest wykrywana:
```bash
sudo apt install libcamera-apps
rpicam-hello --list-cameras
```
Powinniśmy zobaczyć komunikat:
```bash
Available cameras
-----------------
0 : imx219 [3280x2464 10-bit RGGB] (/base/soc/i2c0mux/i2c@1/imx219@10)
    Modes: 'SRGGB10_CSI2P' : 640x480 [103.33 fps - (1000, 752)/1280x960 crop]
                             1640x1232 [41.85 fps - (0, 0)/3280x2464 crop]
                             1920x1080 [47.57 fps - (680, 692)/1920x1080 crop]
                             3280x2464 [21.19 fps - (0, 0)/3280x2464 crop]
           'SRGGB8' : 640x480 [103.33 fps - (1000, 752)/1280x960 crop]
                      1640x1232 [41.85 fps - (0, 0)/3280x2464 crop]
                      1920x1080 [47.57 fps - (680, 692)/1920x1080 crop]
                      3280x2464 [21.19 fps - (0, 0)/3280x2464 crop]

```

## 4. Instalacja oprogramowania

Zainstaluj zależności wymagane do obsługi kamery i analizy kodów QR:
```bash
sudo apt update
sudo apt install python3-pip python3-opencv python3-pyzbar python3-libcamera libzbar0 python3-picamera2 python3-numpy -y
```
Następnie skopiuj lub sklonuj repozytorium z plikiem `camera_module.py` na swój Raspberry Pi.

## 5. Użycie

Zaimportuj klasę camera do swojego skryptu i skorzystaj z dostępnych metod w celu odczytania wiadomości z kodu QR.

Przykład:
```python
from qrRead import CameraModule
from picamera2 import Picamera2

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

print("Show qr code to camer in oreder to read data...")
while True:
    if cam.qr_event.wait(timeout=5):
        print("QR code detected!")
        print(f"JSON: \n {cam.qr_result}")
        cam.stop_scan()
        cam.cleanup()
        break
    else:
        print("Waiting for QR code...")
```

Output:
```bash
Initializing camera...
[9:18:04.568028756] [2118]  INFO Camera camera_manager.cpp:330 libcamera v0.5.2+99-bfd68f78
[9:18:04.767416960] [2122]  INFO IPAProxy ipa_proxy.cpp:180 Using tuning file /usr/share/libcamera/ipa/rpi/vc4/imx219.json
[9:18:04.823124017] [2122]  INFO Camera camera_manager.cpp:220 Adding camera '/base/soc/i2c0mux/i2c@1/imx219@10' for pipeline handler rpi/vc4
[9:18:04.824654019] [2122]  INFO RPI vc4.cpp:440 Registered camera /base/soc/i2c0mux/i2c@1/imx219@10 to Unicam device /dev/media3 and ISP device /dev/media0
[9:18:04.825620020] [2122]  INFO RPI pipeline_base.cpp:1107 Using configuration file '/usr/share/libcamera/pipeline/rpi/vc4/rpi_apps.yaml'
[9:18:04.914369110] [2118]  INFO Camera camera.cpp:1215 configuring streams: (0) 1200x1800-RGB888/SMPTE170M/Rec709/None/Full (1) 3280x2464-SBGGR10_CSI2P/RAW
[9:18:04.916651113] [2122]  INFO RPI vc4.cpp:615 Sensor: /base/soc/i2c0mux/i2c@1/imx219@10 - Selected sensor format: 3280x2464-SBGGR10_1X10/RAW - Selected unicam format: 3280x2464-pBAA/RAW
Camera ready for scanning.
Show qr code to camer in oreder to read data...
Waiting for QR code...
Waiting for QR code...
Waiting for QR code...
Waiting for QR code...
QR scanning thread exiting.
QR code detected!
JSON: 
 {'format': 'qr', 'data': '{"email":"jemail@gmail.com","First_name":"Jan","otherField":"Some data","token":"417 ... 231f"}'
Background QR scan stopped.
Cleaning up camera...
Camera shutdown complete
```