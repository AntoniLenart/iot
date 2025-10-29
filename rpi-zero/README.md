# Moduł odcisków palców UART na Raspberry Pi

Prosty sterownik CLI dla modułu napisany w Pythonie; przewodnik konfiguracji 

To repozytorium zawiera podstawowa implementację w języku Python oraz narzędzie wiersza poleceń do sterowania czujnikiem odcisków palców UART  z komputera Raspberry Pi Zero, 3, 4 lub 5 za pomocą interfejsu szeregowego (UART).

## 1. Wymagania sprzętowe
- Raspberry Pi Zero / 3 / 4 / 5 (z pinami GPIO UART)
- Czujnik odcisków palców UART
- przewody

## 2. Schemat połączeń elektrycznych

| Pin modułu odcisków palców | Pin Raspberry Pi |Funkcja / Uwagi |
|--|--|--| 
| VCC | **5 V** | Zasilanie (niektóre moduły tolerują napięcie od 3,3 V do 5 V) |
| GND | GND | Uziemiene |
| TXD | GPIO15 (RXD) |  Moduł TX → Pi RX |
| RXD | GPIO14 (TXD) | Moduł RX ← Pi TX |

TX i RX muszą być skrzyżowane między Pi a czujnikiem. Podłącz uziemienie, w przeciwnym razie komunikacja szeregowa nie będzie działać.

## 3. Włącz interfejs szeregowy
Uruchom:
```bash
sudo raspi-config
```
Przejdź do
`Interface Options → Serial Port`
- **Login shell over serial?** → **No**
- **Enable serial hardware?** → **Yes**

Uruchom ponownie Pi:
```bash
sudo reboot
```
Po ponownym uruchomieniu sprawdź:
```bash
ls -l /dev/serial0
```
Powininno wskazywać albo `/dev/ttyAMA0`, albo `/dev/ttyS0`.

## 4. Instalacja oprogramowania
Zainstaluj Python 3 i zależności:
```bash
sudo apt update
sudo apt install python3-pip
pip3 install pyserial
```
Sklonuj lub skopiuj to repozytorium na swój Pi.
## 5. Uruchomienie CLI

Po poprawnym podłączeniu czujnika i skonfigurowaniu UART możesz uruchomić program testowy CLI,
który pozwala na przechwytywanie odcisków, porównania oraz zapis danych w formacie binarnym i JSON.

Wyświetlenie dostępnych poleceń:
```bash
python3 fingerprint_module.py
```

Output:
```bash
Fingerprint Module CLI Utility
--------------------------------
Control your UART fingerprint sensor connected to Raspberry Pi.

Usage:
  python3 fingerprint_module.py [--port PORT] [--baud BAUD] [--timeout TIMEOUT] <command> [arguments]

Commands:
  upload_image     Capture and save fingerprint image (124x148 packed)
  upload_eigen     Capture and save eigenvalue (fingerprint template)
  compare_eigen    Compare saved eigenvalue (.bin or .json) with live scan
  save_eigen       Capture and save fingerprint eigenvalue in .bin and .json

Options:
  --port     Serial device path (default: /dev/serial0)
  --baud     UART baud rate (default: 19200)
  --timeout  Serial read timeout in seconds (default: 10)

```

## 6. Typowe komendy

#### 6.1 Przechwytywanie i zapis obrazu odcisku palca

Przechwytuje surowy obraz odcisku palca z czujnika i zapisuje go w formacie binarnym (`.raw`).

```bash
python3 fingerprint_module.py upload_image
```

Output:
```bash
Capturing image... place finger on sensor.
Image captured: 9176 bytes
Saved raw image to finger_image.raw
```
Tworzy plik finger_image.raw (124 × 148 pikseli, 9176 bajtów).
Obraz można później przekonwertować na format PNG za pomocą np. biblioteki Pillow.

---

#### 6.2 Przechwytywanie wartości własnej (szablon odcisku)

Wyodrębnia z obrazu cechy odcisku palca i zapisuje je w postaci szablonu (`eigenvalue`) w dwóch formatach:
- binarnym (`.bin`)`
- JSON (`.json`, zakodowany w Base64)

```bash
python3 fingerprint_module.py upload_eigen
```

Output:
```bash
Capturing eigenvalue...
Eigenvalue length: 193 bytes
Saved eigenvalue to eigenvalue.bin
Saved eigenvalue to eigenvalue.json
```

---

#### 6.3 Porównanie wartości własnej z aktualnym odciskiem

Porównuje zapisany wcześniej szablon odcisku z nowym skanem pobranym z czytnika.
Możesz podać zarówno plik binarny .bin, jak i JSON .json (narzędzie automatycznie wykryje format).

```bash
python3 fingerprint_module.py compare_eigen palec.bin
```
lub
```bash
python3 fingerprint_module.py compare_eigen palec.json
```

Output:
```bash
Loading eigenvalue from JSON file: palec.json
Loaded eigenvalue (193 bytes). Place finger for comparison.
Compare result ACK: 0
Fingerprint match SUCCESS
```

| Kod | Znaczenie |
|--|--|
| 0x00 | Dopasowanie udane |
| 0x01 | Odcisk nie pasuje |
| 0x08 | Nie wykryto palca w czasie oczekiwania (Timeout)|

#### 6.4 Zapisanie wartości własnej do pliku o wybranej nazwie

Tworzy jednocześnie pliki `.bin` i `.json` z aktualnie zeskanowanego odcisku palca.

```bash
python3 fingerprint_module.py save_eigen palec
```

Output:
```bash
Place finger for eigenvalue capture...
Eigenvalue saved to palec.bin
Eigenvalue saved to palec.json
```
W folderze pojawią się dwa pliki:
- `palec.bin` — surowe dane szablonu
- `palec.json` — ten sam szablon w formacie Base64

#### Struktura pliku JSON

Przykładowa zawartość palec.json:
```json
{
  "format": "fingerprint_eigenvalue_v1",
  "length": 193,
  "encoding": "base64",
  "eigen_b64": "AAQeCyDz83ovF0...=="
}
```


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

## 5. Uruchomienie CLI

Skrypt `camera_module.py` zawiera prosty interfejs wiersza poleceń (CLI).
Możesz go uruchomić bezpośrednio w terminalu.

Wyświetlenie pomocy:
```bash
python3 camera_module.py
```

Output:
```bash
[INFO] Camera ready for live scanning.

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


Enter command: 
```

# 6. Typowe polecenia

### 6.1 Tryb skanowania na żywo

Otwiera strumień z kamery i analizuje każdą klatkę.
Zatrzymuje się po wykryciu kodu QR lub po naciśnięciu `q`.
```bash
Enter command: live
```

Output:
```bash
[INFO] Starting live QR scan...
[INFO] QR detected: https://allegro.pl
[INFO] Saved image: qr_output/qr_20251029_102413.jpg
[INFO] Saved JSON:  qr_output/qr_20251029_102413.json
[INFO] QR code saved.

```

## 7. Struktura zapisu danych

Każdy wykryty kod QR jest zapisywany w pliku wybranym katalogu w następującym formacie:

```json
{
  "format": "qr",
  "data": "https://allegro.pl"
}
```
