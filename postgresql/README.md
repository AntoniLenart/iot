# 📘 Dokumentacja bazy danych

## 📑 Spis treści
 
1. Architektura bazy danych
2. Typy enumeracyjne
3. Struktura tabel
   - 3.1 `users`
   - 3.2 `devices`
   - 3.3 `buildings`, `rooms`, `doors`, `desks`
   - 3.4 `user_groups`, `user_access_groups`, `access_policies`, `group_policies`, `credential_policies`
   - 3.5 `credentials`, `biometric_templates`, `rfid_cards`, `qr_codes`
   - 3.6 `reservations`
   - 3.7 `access_logs`, `events`, `emergencies`, `admin_audit`
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
| `user_type` | `'employee'`, `'guest'`, `'service'`, `'admin'` | Typ użytkownika systemu |
| `access_action` | `'grant'`, `'deny'`, `'challenge'` | Wynik autoryzacji dostępu |

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
| `metadata` | `jsonb` | Dodatkowe atrybuty (np. dane HR, stres, dostęp mobilny) |

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

### 3.3 🏢 `buildings`, `rooms`, `doors`, `desks`

| Tabela | Rola | Klucz główny | Relacje |
|---------|------|---------------|---------|
| `buildings` | Opis budynku (adres, nazwa) | `building_id` | 1–N z `rooms` |
| `rooms` | Pomieszczenia | `room_id` | FK → `buildings` |
| `doors` | Fizyczne drzwi | `door_id` | FK → `rooms`, FK → `devices` |
| `desks` | Stanowiska pracy | `desk_id` | FK → `rooms`, N–1 z `reservations` |

---

### 3.4 🔐 Grupy i polityki dostępu

**`access_policies`**  
Zawiera reguły (JSON) określające dostęp do pomieszczeń, czas, dni tygodnia.  

| Tabela                 | Kolumna            | Typ | Wymagane | Domyślna wartość    | Opis                                                                                       |
| ---------------------- | ----------------- | ---------- | -------- | ------------------ | ------------------------------------------------------------------------------------------ |
| **policy_rooms**       | `policy_room_id`   | `uuid`     | ✅        | `gen_random_uuid()` | Klucz główny wpisu                                                                         |
|                        | `policy_id`        | `uuid`     | ✅        | —                  | Odwołanie do polityki (`access_policies.policy_id`), `ON DELETE CASCADE ON UPDATE CASCADE` |
|                        | `room_id`          | `uuid`     | ✅        | —                  | Powiązany pokój (`rooms.room_id`), `ON DELETE CASCADE`                                     |
|                        | `include_subdoors` | `boolean`  | ✅        | `true`             | Czy automatycznie obejmuje wszystkie drzwi w pokoju                                        |
|                        | `is_active`        | `boolean`  | ✅        | `true`             | Czy wpis jest aktywny                                                                      |
|                        | `metadata`         | `jsonb`    | ❌        | `'{}'`             | Dodatkowe informacje (np. warunki specjalne)                                               |
| **policy_doors**       | `policy_door_id`   | `uuid`     | ✅        | `gen_random_uuid()` | Klucz główny                                                                               |
|                        | `policy_room_id`   | `uuid`     | ✅        | —                  | Odwołanie do `policy_rooms.policy_room_id`, `ON DELETE CASCADE ON UPDATE CASCADE`          |
|                        | `door_id`          | `uuid`     | ✅        | —                  | Powiązane drzwi (`doors.door_id`), `ON DELETE CASCADE`                                     |
|                        | `is_active`        | `boolean`  | ✅        | `true`             | Czy wpis jest aktywny                                                                      |
|                        | `metadata`         | `jsonb`    | ❌        | `'{}'`             | Dane rozszerzające                                                                         |
| **policy_days**        | `policy_day_id`    | `uuid`     | ✅        | `gen_random_uuid()` | Klucz główny                                                                               |
|                        | `policy_door_id`   | `uuid`     | ✅        | —                  | Odwołanie do `policy_doors.policy_door_id`, `ON DELETE CASCADE ON UPDATE CASCADE`          |
|                        | `day_of_week`      | `smallint` | ✅        | —                  | Dzień tygodnia (0 = niedziela, 6 = sobota)                                               |
|                        | `is_active`        | `boolean`  | ✅        | `true`             | Czy reguła obowiązuje w danym dniu                                                        |
| **policy_time_ranges** | `time_range_id`    | `uuid`     | ✅        | `gen_random_uuid()` | Klucz główny                                                                               |
|                        | `policy_day_id`    | `uuid`     | ✅        | —                  | Odwołanie do `policy_days.policy_day_id`, `ON DELETE CASCADE ON UPDATE CASCADE`            |
|                        | `is_active`        | `boolean`  | ✅        | `true`             | Czy zakres czasowy jest aktywny                                                           |
|                        | `start_time`       | `time`     | ✅        | —                  | Czas rozpoczęcia dostępu                                                                  |
|                        | `end_time`         | `time`     | ✅        | —                  | Czas zakończenia dostępu (`CHECK end_time > start_time`)                                  |


```
access_policies
   └── policy_rooms
         └── policy_doors
               └── policy_days
                     └── policy_time_ranges
```

**`access_groups`**  
Grupy logiczne (np. „pracownicy IT”, „goście”, „utrzymanie”).  

**`user_access_groups`**  
Łączy użytkowników z grupami (relacja N–M).  

**`group_policies`**  
Łączy polityki (`access_policies`) z grupami.  

Dodatkowo:
- `credential_policies` — przypisanie polityk bezpośrednio do credentiali (przeznaczone dla credentiali zewnętrznych, tzn. bez `user_id`).
  - Główne kolumny:
    - `credential_id` (FK → credentials.credential_id)
    - `policy_id` (FK → access_policies.policy_id)
    - `assigned_by` (kto przypisał, opcjonalny FK → users)
    - `assigned_at` (timestamp)
    - `valid_from`, `valid_until` (okres ważności przypisania)
    - `is_active` (czy przypisanie jest aktywne)
    - `metadata` (jsonb)
  - Zachowanie: trigger `validate_credential_policy_external` blokuje wstawienia/aktualizacje przypisań, jeśli powiązany credential ma `user_id` (czyli nie jest credentialem zewnętrznym).

---

### 3.5 🔑 Poświadczenia i biometria

| Tabela | Cel |
|---------|-----|
| `credentials` | Dane uwierzytelniające użytkownika |
| `biometric_templates` | Zaszyfrowane wzorce biometryczne |
| `rfid_cards` | Karty RFID (z historią emisji) |
| `qr_codes` | Kody QR (tymczasowe dostępy) |

Uwaga:
- `qr_codes` nie posiada bezpośredniego `user_id` — kody mogą być wystawiane dla osób zewnętrznych (informacje kontaktowe przechowywane w `recipient_info`) lub powiązane z credentialem w systemie.
- `usage_count` przechowuje liczbę użyć kodu; aktualizacja `usage_count` oraz egzekwowanie limitów (inkrementacja po każdym użyciu) leży po stronie aplikacji/serwisu integrującego czytnik. Trigger `set_credential_inactive_on_qr_invalid` reaguje na zmiany rekordu QR (INSERT/UPDATE) i dezaktywuje powiązany credential gdy kod:
  - jest oznaczony jako nieaktywny (`is_active = false`),
  - ma `valid_until <= now()`,
  - lub `usage_count >= usage_limit`.

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

| Tabela | Rola |
|---------|------|
| `access_logs` | Każde przejście przez drzwi, wynik `grant/deny/challenge` |
| `events` | Zdarzenia alarmowe (np. nieudane logowanie, włamanie) |
| `emergencies` | Predefiniowane akcje awaryjne (np. „otwórz wszystkie drzwi”) |
| `admin_audit` | Rejestr działań administratorów |

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
**Opis:** Dezaktywuje urządzenia (`devices`), które nie były widziane w ciągu ostatnich 24 godzin. Aktywuje urządzenia, które były widziane w ciągu ostatnich 24 godzin i mają stan nieaktywny. Można uruchomić ręcznie lub przez cron.  

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
