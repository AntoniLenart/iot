import { useState, useEffect } from "react";
import { getConfig } from "../../src/config";

const { SERVER_ENDPOINT } = getConfig()

export default function AddUser() {
  const [users, setUsers] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("user");
  const [userFormData, setUserFormData] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    user_type: "employee",
    department: "",
    employee_number: "",
  });
  const [rfidFormData, setRfidFormData] = useState({
    user_id: "",
    serial: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // For RFID user list purpose
  const fetchUsers = async () => {
    try {
      const response = await fetch(SERVER_ENDPOINT + '/api/v1/users/list');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      console.log(data)
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
      fetchUsers();
  }, [refreshTrigger]);

  // Optional automatic refresh -> 30seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setUserFormData({ ...userFormData, [name]: value });
  };

  const handleRfidChange = (e) => {
    const { name, value } = e.target;
    setRfidFormData({ ...rfidFormData, [name]: value });
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (userFormData.password !== userFormData.confirmPassword) {
      setMessage('Błąd: Hasła nie pasują do siebie');
      setLoading(false);
      return;
    }

    const payload = { ...userFormData, is_active: true, metadata: {} };

    try {
      const response = await fetch(SERVER_ENDPOINT + "/api/v1/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Nie udało się utworzyć użytkownika");
      }

      const data = await response.json();
      setMessage("Użytkownik utworzony pomyślnie!");
      setUserFormData({
        username: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        user_type: "employee",
        department: "",
        employee_number: "",
      });

      setRefreshTrigger(prev => prev + 1); // For current_user list refresh

    } catch (error) {
      setMessage(`Błąd: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRfidSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // First, create a credential for RFID
      const credResponse = await fetch(SERVER_ENDPOINT + "/api/v1/credentials/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: rfidFormData.user_id,
          credential_type: "rfid_card",
          identifier: rfidFormData.serial, // Use serial as identifier
          issued_by: JSON.parse(localStorage.getItem('user')).user_id,
          is_active: true,
          metadata: {},
        }),
      });

      if (!credResponse.ok) {
        const errorData = await credResponse.json();
        throw new Error(errorData.error || "Nie udało się utworzyć poświadczenia");
      }

      const credData = await credResponse.json();
      const credentialId = credData.credential.credential_id;

      // Then, create the RFID card
      const rfidResponse = await fetch(SERVER_ENDPOINT + "/api/v1/rfid_cards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential_id: credentialId,
          serial: rfidFormData.serial,
          is_active: true,
          issued_by: JSON.parse(localStorage.getItem('user')).user_id,
          metadata: {},
        }),
      });

      if (!rfidResponse.ok) {
        const errorData = await rfidResponse.json();
        throw new Error(errorData.error || "Nie udało się zarejestrować karty RFID");
      }

      const rfidData = await rfidResponse.json();
      setMessage("Karta RFID zarejestrowana pomyślnie!");
      setRfidFormData({ user_id: "", serial: "" });
    } catch (error) {
      setMessage(`Błąd: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-4xl font-semibold mb-6">Dodaj użytkownika / RFID</h2>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes("Błąd") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`py-2 px-4 ${activeTab === "user" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("user")}
        >
          Użytkownik
        </button>
        <button
          className={`py-2 px-4 ${activeTab === "rfid" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"}`}
          onClick={() => setActiveTab("rfid")}
        >
          RFID
        </button>
      </div>

      {/* User Tab */}
      {activeTab === "user" && (
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Imię *</label>
              <input
                type="text"
                name="first_name"
                value={userFormData.first_name}
                onChange={handleUserChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nazwisko *</label>
              <input
                type="text"
                name="last_name"
                value={userFormData.last_name}
                onChange={handleUserChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nazwa użytkownika</label>
              <input
                type="text"
                name="username"
                value={userFormData.username}
                onChange={handleUserChange}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Adres e-mail *</label>
              <input
                type="email"
                name="email"
                value={userFormData.email}
                onChange={handleUserChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Dział</label>
              <input
                type="text"
                name="department"
                value={userFormData.department}
                onChange={handleUserChange}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Numer telefonu</label>
              <input
                type="text"
                name="phone"
                value={userFormData.phone}
                onChange={handleUserChange}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Typ użytkownika</label>
              <select
                name="user_type"
                value={userFormData.user_type}
                onChange={handleUserChange}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="employee">Pracownik</option>
                <option value="guest">Gość</option>
                <option value="service">Serwis</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Numer pracownika</label>
              <input
                type="text"
                name="employee_number"
                value={userFormData.employee_number}
                onChange={handleUserChange}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Hasło *</label>
              <input
                type="password"
                name="password"
                value={userFormData.password}
                onChange={handleUserChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Potwierdź hasło *</label>
              <input
                type="password"
                name="confirmPassword"
                value={userFormData.confirmPassword}
                onChange={handleUserChange}
                required
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Tworzenie..." : "Dodaj użytkownika"}
          </button>
        </form>
      )}

      {/* RFID Tab */}
      {activeTab === "rfid" && (
        <form onSubmit={handleRfidSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ID użytkownika *</label>

            <select
              name="user_id"
              value={rfidFormData.user_id}
              onChange={handleRfidChange}
              required
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wybierz użytkownika</option>

              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_id} — {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Numer seryjny karty RFID *</label>
            <input
              type="text"
              name="serial"
              value={rfidFormData.serial}
              onChange={handleRfidChange}
              required
              placeholder="Wprowadź numer seryjny"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Rejestrowanie..." : "Zarejestruj kartę RFID"}
          </button>
        </form>
      )}
    </div>
  );
}