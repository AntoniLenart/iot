# 📘 Dokumentacja bazy danych

## 📑 Spis treści
 
1. Architektura bazy danych
2. Typy enumeracyjne
3. Struktura tabel
   - 3.1 `users`
   - 3.2 `devices`
   - 3.3 `buildings`, `rooms`, `doors`, `desks`
   - 3.4 `access_groups`, `user_access_groups`, `access_policies`, `group_policies`
   - 3.5 `credentials`, `biometric_templates`, `rfid_cards`, `qr_codes`
   - 3.6 `reservations`
   - 3.7 `access_logs`, `events`, `emergencies`, `admin_audit`
4. Indeksy i klucze obce
5. Ograniczenia (constraints)

## 1️⃣ Architektura bazy danych

Schemat: `access_mgmt`  
Rozszerzenia użyte w bazie:
- `citext` - tekst bez rozróżniania wielkości liter,  
- `pgcrypto` - generowanie UUID i możliwość szyfrowania.

Każda tabela zawiera:
- identyfikator w formacie `uuid`,  
- kolumny `created_at`, `updated_at` (tam, gdzie logiczne),  
- opcjonalną kolumnę `metadata jsonb` - do przechowywania elastycznych danych.

## 2️⃣ Typy enumeracyjne

| Typ | Wartości | Opis |
|------|-----------|------|
| `credential_type` | `'rfid_card'`, `'fingerprint'`, `'qr_code'`, `'mobile_token'` | Typ metody uwierzytelniania |
| `device_type` | `'rfid_reader'`, `'fingerprint_reader'`, `'camera_qr'`, `'door_controller'`, `'gateway'` | Kategoria urządzenia IoT |
| `user_type` | `'employee'`, `'guest'`, `'service'`, `'admin'` | Typ użytkownika systemu |
| `access_action` | `'grant'`, `'deny'`, `'challenge'` | Wynik autoryzacji dostępu |

---

## 3️⃣ Struktura tabel

### 4.1 🧑‍💼 Tabela `users`

**Opis:**  
Przechowuje dane wszystkich użytkowników systemu: pracowników, gości, serwisantów i administratorów.

**Klucz główny:** `user_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `user_id` | `uuid` | Unikalny identyfikator |
| `username` | `text` | Login (opcjonalny) |
| `first_name`, `last_name` | `text` | Imię i nazwisko |
| `email` | `citext` | Adres e-mail (unikalny) |
| `phone` | `text` | Numer telefonu |
| `user_type` | `user_type` | Rola użytkownika |
| `department` | `text` | Dział lub jednostka |
| `is_active` | `boolean` | Czy użytkownik aktywny |
| `metadata` | `jsonb` | Dodatkowe atrybuty (np. dane HR, stres, dostęp mobilny) |

**Indeksy:**
- `ux_users_email` – unikalny indeks e-mail  
- `ix_users_user_type` – filtracja po typie  
- `ix_users_metadata_gin` – wyszukiwanie po JSON

---

### 4.2 ⚙️ Tabela `devices`

**Opis:**  
Rejestr wszystkich urządzeń IoT w systemie (czytniki, kontrolery drzwi, kamery).

**Kolumny:**

| Nazwa | Typ | Opis |
|--------|------|------|
| `device_id` | `uuid` | Klucz główny |
| `name` | `text` | Nazwa urządzenia |
| `device_type` | `device_type` | Typ urządzenia |
| `room_id` | `uuid` | FK → `rooms` |
| `ip_address` | `inet` | Adres IP |
| `mac_address` | `macaddr` | Adres MAC |
| `last_seen` | `timestamptz` | Ostatnie połączenie |
| `metadata` | `jsonb` | Konfiguracja urządzenia |

**Indeksy:**
- `ix_devices_type`  
- `ix_devices_location`  
- `ix_devices_metadata_gin`

---

### 4.3 🏢 `buildings`, `rooms`, `doors`, `desks`

| Tabela | Rola | Klucz główny | Relacje |
|---------|------|---------------|---------|
| `buildings` | Opis budynku (adres, nazwa) | `building_id` | 1–N z `rooms` |
| `rooms` | Pomieszczenia | `room_id` | FK → `buildings` |
| `doors` | Fizyczne drzwi | `door_id` | FK → `rooms`, FK → `devices` |
| `desks` | Stanowiska pracy | `desk_id` | FK → `rooms`, N–1 z `reservations` |

---

### 4.4 🔐 Grupy i polityki dostępu

**`access_groups`**  
Grupy logiczne (np. „pracownicy IT”, „goście”, „utrzymanie”).  

**`user_access_groups`**  
Łączy użytkowników z grupami (relacja N–M).

**`access_policies`**  
Zawiera reguły (JSON) określające dostęp do pomieszczeń, czas, dni tygodnia.

**`group_policies`**  
Łączy polityki z grupami.

---

### 4.5 🔑 Poświadczenia i biometria

| Tabela | Cel |
|---------|-----|
| `credentials` | Dane uwierzytelniające użytkownika |
| `biometric_templates` | Zaszyfrowane wzorce biometryczne |
| `rfid_cards` | Karty RFID (z historią emisji) |
| `qr_codes` | Kody QR (tymczasowe dostępy) |

---

### 4.6 💺 `reservations`

Obsługuje rezerwacje stanowisk i biurek.  
Zawiera kontrolę kolizji czasowych (`CHECK (end_at > start_at)`).

---

### 4.7 🧾 Logi i zdarzenia

| Tabela | Rola |
|---------|------|
| `access_logs` | Każde przejście przez drzwi, wynik `grant/deny/challenge` |
| `events` | Zdarzenia alarmowe (np. nieudane logowanie, włamanie) |
| `emergencies` | Predefiniowane akcje awaryjne (np. „otwórz wszystkie drzwi”) |
| `admin_audit` | Rejestr działań administratorów |

## 4️⃣ Indeksy i klucze obce

Przykłady:
| Tabela | Kolumna | Typ | Cel |
|--------|----------|-----|-----|
| `users` | `email` | UNIQUE | unikalność e-mail |
| `credentials` | `(credential_type, identifier)` | UNIQUE | uniknięcie duplikacji kart |
| `access_logs` | `occurred_at` | INDEX | analizy czasowe |
| `reservations` | `(desk_id, start_at, end_at)` | INDEX | sprawdzanie dostępności |

---

## 5️⃣ Ograniczenia

| Nazwa | Definicja | Cel |
|--------|------------|-----|
| `chk_reservation_times` | `end_at > start_at` | Zapobiega błędnym rezerwacjom |
| `chk_qr_valid_until` | `valid_until > valid_from` | Chroni przed błędną datą QR |

---