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

## 5. Użycie
Zaimportuj klasę fingerprint do swojego skryptu i skorzystaj z dostępnych metod w celu pozyskania wartości `eigenvlues` pochodzących z odcisku palca.

Przykład:
```python
from fingerprintRead import FingerprintModule, DEFAULT_PORT, DEFAULT_BAUD
import time

fp = FingerprintModule(port=DEFAULT_PORT, baud=DEFAULT_BAUD, timeout=0)

print("Get eigenvalues of your fingerprint")
print("Capturing eigenvalues...")
fp.new_scan()
while True:
    data = fp.get_eigenvalues()
    if data is not None:
        print(f"Eigenvalues length: {len(data)} bytes")
        print(data)
        print(f"JSON: \n {fp.eigen_to_json(data)}")
        break
    else:
        print("Waiting for data from scanner...")
        time.sleep(1)
```

Output:
```bash
Get eigenvalues of your fingerprint
Capturing eigenvalues...
Waiting for data from scanner...
Waiting for data from scanner...
Waiting for data from scanner...
Waiting for data from scanner...
Waiting for data from scanner...
Waiting for data from scanner...
Eigenvalues length: 196 bytes
b'\x00\x00\x00\x1a ... x00\x00\x00'
JSON: 
 {'format': 'fingerprint', 'data': 'AAAAGhyrR ... AAAAAAA=='}
```