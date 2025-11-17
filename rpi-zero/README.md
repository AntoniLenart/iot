# Konfiguracja środowiska
Upewnij się że Python 3 i pip są zainstalowane na twoim systemie:
```bash
sudo apt update
sudo apt install python3 python3-pip
sudo apt install python3-opencv python3-pyzbar python3-libcamera libzbar0 python3-picamera2 python3-numpy -y
```
Sklonuj lub skopiuj to repozytorium na swój Pi, stwórz nowe środowisko wirtualne pythona, aktywuj je i zainstaluj wymagane zależności.
```bash
python3 -m venv pi-env --system-site-packages
source pi-venv/bin/activate
pip install -r requirements.txt
```
Aby wyjść ze środowiska wirtualnego należy wpisać komendę
```bash
deactivate
```