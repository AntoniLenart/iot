# 📘 Dokumentacja bazy danych

## 📑 Spis treści
 
1. Architektura bazy danych
2. Typy enumeracyjne
3. Struktura tabel
   - 3.1 `users`
   - 3.2 `devices`
   - 3.3 `rooms`, `doors`, `desks`
   - 3.4 `user_groups`, `user_access_groups`, `access_policies`, `group_policies`, `credential_policies`
   - 3.5 `credentials`, `biometric_templates`, `rfid_cards`, `qr_codes`
   - 3.6 `reservations`
   - 3.7 `access_logs`, `events`, `emergencies`, `admin_audit`
   - 3.8 `svg_files`
4. Wyzwalacze i funkcje

## 1️⃣ Architektura bazy danych

Schemat: `access_mgmt`  
Rozszerzenia użyte w bazie:
- `citext` - tekst bez rozróżniania wielkości liter  
- `pgcrypto` - generowanie UUID i pomocnicze funkcje kryptograficzne

Zasady projektowe:
- Każda główna encja ma `uuid` jako identyfikator.
- Wiele tabel zawiera `metadata jsonb` dla elastycznych atrybutów.
- Polityki dostępu są zdefiniowane niezależnie i mogą być przypisane do grup użytkowników lub bezpośrednio do credentiali zewnętrznych.

## 2️⃣ Typy enumeracyjne

| Typ | Wartości | Opis |
|------|-----------|------|
| `credential_type` | `'rfid_card'`, `'fingerprint'`, `'qr_code'` | Typ metody uwierzytelniania |
| `device_type` | `'rfid_reader'`, `'fingerprint_reader'`, `'camera'`, `'door_controller'`, `'gateway'` | Kategoria urządzenia IoT |
| `user_type` | `'employee'`, `'guest'`, `'service'`, `'admin'` | Rola użytkownika systemu |
| `access_action` | `'allow'`, `'deny'`, `'challenge'` | Wynik autoryzacji dostępu |

---

## 3️⃣ Struktura tabel

### 3.1 🧑‍💼 Tabela `users`

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
| `password_hash` | `text` | Hash hasła |
| `user_type` | `user_type` | Rola użytkownika |
| `department` | `text` | Dział lub jednostka |
| `employee_number` | `text` | Numer pracownika (opcjonalny) |
| `is_active` | `boolean` | Czy użytkownik aktywny |
| `created_at` | `timestamptz` | Czas utworzenia |
| `updated_at` | `timestamptz` | Czas ostatniej aktualizacji |
| `metadata` | `jsonb` | Dodatkowe atrybuty |

**Indeksy:**
- `ux_users_email` – unikalny indeks e-mail  
- `ix_users_user_type` – filtracja po typie  
- `ix_users_metadata_gin` – wyszukiwanie po JSON

---

### 3.2 ⚙️ Tabela `devices`

**Opis:**  
Rejestr wszystkich urządzeń IoT w systemie (czytniki, kontrolery drzwi, kamery).

**Kolumny:**

| Kolumna | Typ | Opis |
|--------|------|------|
| `device_id` | `uuid` | Klucz główny |
| `name` | `text` | Nazwa |
| `device_type` | `device_type` | Typ |
| `model` | `text` | Model |
| `serial_no` | `text` | Numer seryjny |
| `location` | `text` | Lokalizacja |
| `room_id` | `uuid` | FK → `rooms` |
| `ip_address` | `inet` | Adres IP |
| `mac_address` | `macaddr` | Adres MAC |
| `firmware_version` | `text` | Wersja oprogramowania |
| `last_seen` | `timestamptz` | Ostatnie połączenie |
| `is_active` | `boolean` | Czy urządzenie aktywne |
| `created_at` | `timestamptz` | Czas utworzenia |
| `updated_at` | `timestamptz` | Czas ostatniej aktualizacji |
| `metadata` | `jsonb` | Konfiguracja urządzenia |

**Indeksy:**
- `ix_devices_type`  
- `ix_devices_location`  
- `ix_devices_metadata_gin`

---

### 3.3 🏢 `rooms`, `doors`, `desks`

#### `rooms`
**Opis:**  
Przechowuje informacje o pomieszczeniach w systemie.

**Klucz główny:** `room_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `room_id` | `uuid` | Unikalny identyfikator |
| `name` | `text` | Nazwa pomieszczenia |
| `description` | `text` | Opis pomieszczenia |
| `floor` | `text` | Piętro |
| `capacity` | `int` | Pojemność |
| `metadata` | `jsonb` | Dodatkowe atrybuty |

#### `doors`
**Opis:**  
Przechowuje informacje o drzwiach w systemie.

**Klucz główny:** `door_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `door_id` | `uuid` | Unikalny identyfikator |
| `room_id` | `uuid` | FK → `rooms` |
| `name` | `text` | Nazwa drzwi |
| `door_type` | `text` | Typ drzwi (np. wewnętrzne, zewnętrzne) |
| `created_at` | `timestamptz` | Czas utworzenia |

#### `desks`
**Opis:**  
Przechowuje informacje o stanowiskach pracy / biurkach.

**Klucz główny:** `desk_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `desk_id` | `uuid` | Unikalny identyfikator |
| `room_id` | `uuid` | FK → `rooms` |
| `code` | `text` | Kod stanowiska (np. A2-12) |
| `description` | `text` | Opis stanowiska |
| `is_available` | `boolean` | Czy dostępne |
| `metadata` | `jsonb` | Dodatkowe atrybuty |

**Indeksy:**  
- `ux_desks_code` – unikalny indeks na kod stanowiska

---

### 3.4 🔐 Grupy i polityki dostępu

#### `user_groups`
**Opis:**  
Grupy logiczne użytkowników (np. „pracownicy IT”, „goście”, „utrzymanie”).

**Klucz główny:** `group_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `group_id` | `uuid` | Unikalny identyfikator |
| `name` | `text` | Nazwa grupy |
| `description` | `text` | Opis grupy |
| `created_at` | `timestamptz` | Czas utworzenia |

**Indeksy:**  
- `ux_user_groups_name` – unikalny indeks na nazwę grupy (case-insensitive)

#### `user_access_groups`
**Opis:**  
Łączy użytkowników z grupami (relacja N–M).

**Klucz główny:** (`user_id`, `group_id`)

| Kolumna | Typ | Opis |
|----------|------|------|
| `user_id` | `uuid` | FK → `users` |
| `group_id` | `uuid` | FK → `user_groups` |
| `assigned_by` | `uuid` | FK → `users` (kto przypisał) |
| `assigned_at` | `timestamptz` | Czas przypisania |

#### `access_policies`
**Opis:**  
Zawiera reguły dostępu (JSON) określające dostęp do pomieszczeń.

**Klucz główny:** `policy_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `policy_id` | `uuid` | Unikalny identyfikator |
| `name` | `text` | Nazwa polityki |
| `description` | `text` | Opis polityki |
| `action` | `access_action` | Domyślna akcja |
| `is_active` | `boolean` | Czy polityka aktywna |
| `created_at` | `timestamptz` | Czas utworzenia |
| `updated_at` | `timestamptz` | Czas ostatniej aktualizacji |
| `metadata` | `jsonb` | Dodatkowe atrybuty (np. dni tygodnia i czas) |

#### `policy_rules`
**Opis:**  
Łączy polityki z pomieszczeniami i przechowuje szczegółowe reguły dostępu (czas, dni tygodnia) w formacie JSON.

**Klucz główny:** `policy_rule_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `policy_rule_id` | `uuid` | Unikalny identyfikator |
| `policy_id` | `uuid` | FK → `access_policies` |
| `room_id` | `uuid` | FK → `rooms` |
| `is_active` | `boolean` | Czy reguła aktywna |
| `rules` | `jsonb` | JSON struktura reguł |
| `metadata` | `jsonb` | Dodatkowe informacje |

#### `group_policies`
**Opis:**  
Łączy polityki (`access_policies`) z grupami.

**Klucz główny:** (`group_id`, `policy_id`)

| Kolumna | Typ | Opis |
|----------|------|------|
| `group_id` | `uuid` | FK → `user_groups` |
| `policy_id` | `uuid` | FK → `access_policies` |
| `assigned_at` | `timestamptz` | Czas przypisania |

#### `credential_policies`
**Opis:**  
Przypisanie polityk bezpośrednio do credentiali zewnętrznych (bez `user_id`).

**Klucz główny:** (`credential_id`, `policy_id`)

| Kolumna | Typ | Opis |
|----------|------|------|
| `credential_id` | `uuid` | FK → `credentials` |
| `policy_id` | `uuid` | FK → `access_policies` |
| `assigned_by` | `uuid` | FK → `users` (opcjonalny) |
| `assigned_at` | `timestamptz` | Czas przypisania |
| `valid_from` | `timestamptz` | Początek ważności |
| `valid_until` | `timestamptz` | Koniec ważności |
| `is_active` | `boolean` | Czy przypisanie aktywne |
| `metadata` | `jsonb` | Dodatkowe informacje |

**Indeksy:**  
- `ix_credential_policies_credential` – indeks na credential_id  
- `ix_credential_policies_policy` – indeks na policy_id  
- `ix_credential_policies_validity` – indeks na okres ważności (gdzie aktywne)

**Zachowanie:** Trigger `validate_credential_policy_external` blokuje przypisania dla credentiali z `user_id`.

---

### 3.5 🔑 Poświadczenia i biometria

#### `credentials`
**Opis:**  
Dane uwierzytelniające użytkownika.

**Klucz główny:** `credential_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `credential_id` | `uuid` | Unikalny identyfikator |
| `user_id` | `uuid` | FK → `users` |
| `credential_type` | `credential_type` | Typ credentiala |
| `identifier` | `text` | Identyfikator (np. UID karty) |
| `issued_by` | `uuid` | FK → `users` |
| `issued_at` | `timestamptz` | Czas wydania |
| `expires_at` | `timestamptz` | Czas wygaśnięcia |
| `is_active` | `boolean` | Czy aktywne |
| `metadata` | `jsonb` | Dodatkowe atrybuty |
| `token_value` | `text` | Wartość tokena |
| `credential_data` | `jsonb` | Elastyczne atrybuty |

**Indeksy:**  
- `ix_credentials_user` – indeks na user_id  
- `ix_credentials_type` – indeks na credential_type  
- Unikalny indeks na (credential_type, identifier)

#### `biometric_templates`
**Opis:**  
Zaszyfrowane wzorce biometryczne.

**Klucz główny:** `template_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `template_id` | `uuid` | Unikalny identyfikator |
| `user_id` | `uuid` | FK → `users` |
| `credential_id` | `uuid` | FK → `credentials` |
| `biometric_type` | `text` | Typ biometryczny |
| `template` | `bytea` | Zaszyfrowany template |
| `template_hash` | `bytea` | Hash template |
| `enrolled_at` | `timestamptz` | Czas rejestracji |
| `enrolled_by` | `uuid` | FK → `users` |
| `is_active` | `boolean` | Czy aktywne |
| `metadata` | `jsonb` | Dodatkowe informacje |

**Indeksy:**  
- `ix_biometric_user` – indeks na user_id

#### `rfid_cards`
**Opis:**  
Historia emisji kart RFID.

**Klucz główny:** `card_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `card_id` | `uuid` | Unikalny identyfikator |
| `credential_id` | `uuid` | FK → `credentials` |
| `serial` | `text` | Numer seryjny |
| `issued_at` | `timestamptz` | Czas wydania |
| `issued_by` | `uuid` | FK → `users` |
| `is_active` | `boolean` | Czy aktywne |
| `metadata` | `jsonb` | Dodatkowe informacje |

#### `qr_codes`
**Opis:**  
Kody QR dla tymczasowych dostępów.

**Klucz główny:** `qr_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `qr_id` | `uuid` | Unikalny identyfikator |
| `code` | `text` | Kod QR |
| `credential_id` | `uuid` | FK → `credentials` |
| `created_at` | `timestamptz` | Czas utworzenia |
| `valid_from` | `timestamptz` | Początek ważności |
| `valid_until` | `timestamptz` | Koniec ważności |
| `usage_limit` | `int` | Limit użycia |
| `usage_count` | `int` | Liczba użyć |
| `is_active` | `boolean` | Czy aktywne |
| `recipient_info` | `text` | Informacje o odbiorcy |
| `metadata` | `jsonb` | Dodatkowe informacje |

**Indeksy:**  
- `ix_qr_validity` – indeks na okres ważności (gdzie aktywne)

**Uwaga:** Trigger `set_credential_inactive_on_qr_invalid` dezaktywuje powiązany credential i kod QR, gdy kod QR jest nieaktywny, wygasł lub przekroczył limit.

---

### 3.6 💺 `reservations`

Obsługuje rezerwacje stanowisk i biurek.  
| Kolumna        | Typ           | Opis                 |
| -------------- | ------------- | -------------------- |
| reservation_id | `uuid`        | Identyfikator        |
| desk_id        | `uuid`        | Powiązane biurko     |
| user_id        | `uuid`        | Powiązany użytkownik |
| start_at       | `timestamptz` | Czas rozpoczęcia     |
| end_at         | `timestamptz` | Czas zakończenia     |
| created_at     | `timestamptz` | Czas utworzenia      |
| created_by     | `uuid`        | Twórca rezerwacji    |
| status         | `text`        | Status rezerwacji    |
| metadata       | `jsonb`       | Dodatkowe dane       |

**Indeksy:**
- `ix_reservations_desk_time`  

---

### 3.7 🧾 Logi i zdarzenia

#### `access_logs`
**Opis:**  
Logi przejść przez drzwi.

**Klucz główny:** `log_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `log_id` | `bigserial` | Unikalny identyfikator |
| `occurred_at` | `timestamptz` | Czas zdarzenia |
| `device_id` | `uuid` | FK → `devices` |
| `door_id` | `uuid` | FK → `doors` |
| `user_id` | `uuid` | FK → `users` |
| `credential_id` | `uuid` | FK → `credentials` |
| `action` | `access_action` | Wynik autoryzacji |
| `success` | `boolean` | Czy udane |
| `reason` | `text` | Powód |
| `raw_event` | `jsonb` | Surowe dane |
| `ip_address` | `inet` | Adres IP |
| `created_at` | `timestamptz` | Czas utworzenia |

**Indeksy:**  
- `ix_access_logs_time` – indeks na czas zdarzenia  
- `ix_access_logs_user` – indeks na user_id  
- `ix_access_logs_door` – indeks na door_id

#### `events`
**Opis:**  
Zdarzenia alarmowe.

**Klucz główny:** `event_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `event_id` | `uuid` | Unikalny identyfikator |
| `occurred_at` | `timestamptz` | Czas zdarzenia |
| `event_type` | `text` | Typ zdarzenia |
| `severity` | `smallint` | Poziom ważności |
| `door_id` | `uuid` | FK → `doors` |
| `device_id` | `uuid` | FK → `devices` |
| `related_log_id` | `bigint` | FK → `access_logs` |
| `description` | `text` | Opis |
| `acknowledged_by` | `uuid` | FK → `users` |
| `acknowledged_at` | `timestamptz` | Czas potwierdzenia |
| `metadata` | `jsonb` | Dodatkowe informacje |

**Indeksy:**  
- `ix_events_time` – indeks na czas zdarzenia  
- `ix_events_type` – indeks na typ zdarzenia

#### `emergencies`
**Opis:**  
Predefiniowane akcje awaryjne.

**Klucz główny:** `emergency_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `emergency_id` | `uuid` | Unikalny identyfikator |
| `name` | `text` | Nazwa akcji |
| `description` | `text` | Opis akcji |
| `trigger_type` | `text` | Typ wyzwalacza |
| `actions` | `jsonb` | Lista akcji |
| `is_active` | `boolean` | Czy aktywne |
| `created_at` | `timestamptz` | Czas utworzenia |

#### `admin_audit`
**Opis:**  
Rejestr działań administratorów.

**Klucz główny:** `audit_id`

| Kolumna | Typ | Opis |
|----------|------|------|
| `audit_id` | `bigserial` | Unikalny identyfikator |
| `admin_user` | `uuid` | FK → `users` |
| `action` | `text` | Akcja |
| `target_type` | `text` | Typ celu |
| `target_id` | `text` | ID celu |
| `details` | `jsonb` | Szczegóły |
| `occurred_at` | `timestamptz` | Czas zdarzenia |
| `ip_address` | `inet` | Adres IP |

**Indeksy:**  
- `ix_admin_audit_time` – indeks na czas zdarzenia

---

### 3.8 🎨 `svg_files`

Przechowuje pliki SVG w systemie.  
| Kolumna | Typ | Opis |
|----------|------|------|
| `svg_id` | `uuid` | Klucz główny |
| `filename` | `text` | Nazwa pliku |
| `description` | `text` | Opis pliku |
| `content` | `text` | Zawartość pliku SVG jako tekst |
| `added_by` | `uuid` | FK → `users` (kto dodał) |
| `created_at` | `timestamptz` | Czas utworzenia |

**Indeksy:**
- `ix_svg_files_added_by`  
- `ix_svg_files_filename`

---

## 4️⃣ Wyzwalacze i funkcje

### 4.1 Trigger function: `set_updated_at`
**Opis:** Automatycznie aktualizuje pole `updated_at` przy każdej modyfikacji wiersza.  

**Szczegóły:**
- Typ: TRIGGER
- Tabele: `users`, `devices`, `access_policies`
- Trigger: BEFORE UPDATE, FOR EACH ROW
- Akcja: `NEW.updated_at := now()`

**Kolumny:**

| Kolumna     | Typ           | Opis                 |
|------------|---------------|---------------------|
| updated_at | `timestamptz` | Czas ostatniej modyfikacji |

---

### 4.2 Trigger function: `validate_user_data`
**Opis:** Waliduje dane użytkownika przy dodawaniu i aktualizacji wierszy w tabeli `users`.  

**Szczegóły:**
- Typ: TRIGGER
- Tabele: `users`
- Trigger: BEFORE INSERT OR UPDATE
- Walidacje:
  - `first_name` i `last_name` nie mogą być puste
  - `email` musi zawierać znak `@`, jeśli jest podany
  - `phone` oczyszczany z niedozwolonych znaków i walidowany: opcjonalny plus na początku, tylko cyfry dalej, max 1 znak `+`

**Kolumny:**

| Kolumna     | Typ       | Opis                   |
|------------|-----------|-----------------------|
| first_name | `text`    | Imię użytkownika       |
| last_name  | `text`    | Nazwisko użytkownika   |
| email      | `text`    | Adres email            |
| phone      | `text`    | Numer telefonu         |

---

### 4.3 Function: `set_devices_active`
**Opis:** Dezaktywuje urządzenia (`devices`), które nie były widziane w ciągu 24 godzin. Aktywuje urządzenia, które były widziane w ciągu ostatnich 24 godzin i mają stan nieaktywny. Można uruchomić ręcznie lub przez cron.  

**Szczegóły:**
- Typ: FUNCTION
- Tabele: `devices`
- Parametry: brak
- Zwraca: void

**Kolumny:**

| Kolumna     | Typ           | Opis                     |
|------------|---------------|-------------------------|
| last_seen  | `timestamptz` | Czas ostatniego kontaktu |
| is_active  | `boolean`     | Aktywność urządzenia      |

---

### 4.4 Function: `set_user_active`
**Opis:** Ustawia aktywność użytkownika (`users`) na podstawie podanego ID i wartości boolean.  

**Szczegóły:**
- Typ: FUNCTION
- Tabele: `users`
- Parametry:
  - `p_user_id uuid` – identyfikator użytkownika
  - `p_active boolean` – czy użytkownik ma być aktywny
- Zwraca: void

**Kolumny:**

| Kolumna    | Typ       | Opis                   |
|-----------|-----------|-----------------------|
| user_id   | `uuid`    | Identyfikator          |
| is_active | `boolean` | Aktywność użytkownika  |

---

### 4.5 Trigger function: `set_credential_inactive_on_qr_invalid`
**Opis:** Dezaktywuje powiązany credential i kod QR, gdy kod QR staje się nieaktywny.  

**Szczegóły:**
- Typ: TRIGGER
- Tabele: `qr_codes`
- Trigger: AFTER INSERT OR UPDATE
- Akcja: Dezaktywuje credential jeśli QR jest nieaktywny, wygasł lub przekroczył limit użycia.

**Kolumny:**

| Kolumna | Typ | Opis |
|----------|------|------|
| `is_active` | `boolean` | Czy kod QR lub credential aktywne |
| `valid_from` | `timestamptz` | Początek ważności kodu QR |
| `valid_until` | `timestamptz` | Koniec ważności kodu QR |
| `usage_count` | `int` | Liczba użyć kodu QR |
| `usage_limit` | `int` | Limit użycia kodu QR |

---

### 4.6 Trigger function: `validate_credential_policy_external`
**Opis:** Blokuje przypisanie polityk do credentiali wewnętrznych (z `user_id`).  

**Szczegóły:**
- Typ: TRIGGER
- Tabele: `credential_policies`
- Trigger: BEFORE INSERT OR UPDATE
- Akcja: Sprawdza, czy credential nie ma `user_id`.

**Kolumny:**

| Kolumna | Typ | Opis |
|----------|------|------|
| `credential_id` | `uuid` | FK → `credentials` |
| `user_id` | `uuid` | FK → `users` (sprawdzane w credentials) |
