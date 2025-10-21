# Moduł odcisków palców UART na Raspberry Pi

Prosty sterownik CLI dla języka Python i przewodnik konfiguracji 

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
## 5. Uruchom CLI
Pokaż dostępne polecenia:
```bash
python3 fingerprint_module.py
```
Typowy output:
```
Fingerprint Module CLI Utility
--------------------------------
Control your UART fingerprint sensor connected to Raspberry Pi.

Examples:
  python3 fingerprint_module.py enroll 1
  python3 fingerprint_module.py identify
  python3 fingerprint_module.py verify 1
  python3 fingerprint_module.py upload_image
...
```
## 6. Typowe komendy

#### Zarejestruj i zapisz obraz odcisku palca
```bash
python3 fingerprint_extended.py upload_image
```
Tworzy plik `finger_image.raw` (124 × 148 pikseli, 9176 bajtów).

---
#### Przechwyć wartość własną (szablon)
Wyodrębnij i zapisz dane charakterystyczne odcisku palca o długości 193 bajtów.
```bash
python3 fingerprint_module.py upload_eigen
```
Tworzy plik `eigenvalue.bin` zawierajacy 193 bity.

---

#### Porównaj plik wartości własnych ze skanem na zywo
Porównuje zapisaną wartość własną (.bin) z nowym skanem odcisku palca.
```bash
python3 fingerprint_module.py compare_eigen eigenvalue.bin
```
Przykladowy output:
```
Loaded eigenvalue (193 bytes). Place finger for comparison.
Fingerprint match SUCCESS
```

#### Zapisz wartość własną do pliku o wybranej nazwie
Jednokrokowe przechwytywanie i zapisywanie.
```bash
python3 fingerprint_module.py save_eigen myfinger.bin
```
Przykladowy output:
```
Place finger for eigenvalue capture...
Eigenvalue saved to myfinger.bin
```
