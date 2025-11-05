# Moduł czytnika RFID na Raspberry Pi

Sterownik modułu RFID opartego na układzie pn532 z którym komunikacja odbywa się po magistrali I2C. Obejmuje odczyt wartości uid z kart standardu ISO/IEC 14443A/MIFARE, komunikację z serwerem MQTT i sterowanie przekaźnikiem w zależności od uzyskanej odpowiedzi z serwera.

## 1. Wymagania sprzętowe
- Raspberry Pi Zero / 3 / 4 / 5 (z pinami GPIO I2C)
- Czujnik odcisków palców UART
- przewody

## 2. Schemat połączeń elektrycznych

| Pin modułu RFID | Pin Raspberry Pi |Funkcja / Uwagi |
|--|--|--| 
| VCC | VCC (**5 V**) | Zasilanie |
| GND | GND | Uziemiene |
| SDA | GPIO2 (Data) |  Pin magistrali I2C transportujący dane |
| SCL | GPIO3 (Clock) | Pin magistrali I2C transportujący informacje zegara |


Przed podłączeniem przekaźnika należy się upewnić, że zwarte są piny konfiguracyjne **Com** i **High** 

| Pin modułu przekaźnika | Pin Raspberry Pi |Funkcja / Uwagi |
|--|--|--| 
| DC+ | VCC (**5 V**) | Zasilanie |
| DC- | GND | Uziemiene |
| IN1 | GPIO12  |  Pin sterujący, gdy jest on w stanie HIGH (5v) przekaźnik zamyka obwód wyjściowy i pozwala na przepływ prądu|

## 3. Włącz magistralę I2C
Uruchom:
```bash
sudo raspi-config
```
Przejdź do
`Interface Options → I2C`
- **Would you like the ARM I2C interface to be enabled?** → **Yes**

Uruchom ponownie Pi:
```bash
sudo reboot
```
Po ponownym uruchomieniu sprawdź czy magistrala i2c wykrywa adres modułu:
```bash
i2cdetect 1 -y
```
Jeżeli w tabeli widoczny jest jeden adres to konfiguracja i podłączenie modułu się powiodły.

## 4. Instalacja oprogramowania
Upewnij się że Python 3 i pip są zainstalowane na twoim systemie:
```bash
sudo apt update
sudo apt install python3 python3-pip
```
Sklonuj lub skopiuj to repozytorium na swój Pi, stwórz nowe środowisko wirtualne pythona, aktywuj je i zainstaluj wymagane zależności.
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
Aby wyjść ze środowiska wirtualnego należy wpisać komendę
```bash
deactivate
```
