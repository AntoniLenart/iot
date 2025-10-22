# Moduł odcisków palców UART na Raspberry Pi

Prosty sterownik CLI dla modulu napisany w Pythonie; przewodnik konfiguracji 

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

#### 6.4 Zapisanie wartosci wlasnej do pliku o wybranej nazwie

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