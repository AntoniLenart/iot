# Konfiguracja środowiska
Upewnij się że Python3, pip oraz inne potrzebne paczki są zainstalowane na twoim systemie:
```bash
sudo apt update
sudo apt install python3 python3-pip python3-opencv python3-libcamera python3-picamera2 python3-numpy -y
```
Stwórz nowe środowisko wirtualne pythona, aktywuj je i zainstaluj wymagane zależności.
```bash
python3 -m venv pi-env --system-site-packages
source pi-venv/bin/activate
pip install -r requirements.txt
```
Aby wyjść ze środowiska wirtualnego wpisz komendę
```bash
deactivate
```
Sklonuj lub skopiuj to repozytorium na swój Pi. Jeden z możliwych sposobów na przesłanie kodu to skopiowanie folderu rpi-zero na twoje urządzenie Pi poprzez scp (wymaga to wcześniejszego skonfigurowania ssh i dostępu komputera oraz Pi do tej samej sieci lokalnej).
```bash
scp -r rpi-zero {nazwa_usera_pi}@{adres_ip_pi}:{sciezka_docelowa_na_pi}
```

Po skopiowaniu repozytorium kolejnymi krokami będzie skopiowanie certyfikatu dla mqtt oraz stworzenie pliku .env według przykładu ('.env.example'). Oba te pliki powinny znaleźć się w folderze rpi-zero.

