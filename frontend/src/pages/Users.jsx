import { useState } from "react";

export default function Users() {
  const [users, setUsers] = useState([
    { id: 1, name: "Jan Kowalski", email: "jan@example.com", rfid: "RFID-1234", biometrics: true, biometricId: "BIO-01", role: "Admin" },
    { id: 2, name: "Anna Nowak", email: "anna@example.com", rfid: null, biometrics: false, biometricId: null, role: "User" },
    { id: 3, name: "Piotr Zieliński", email: "piotr@example.com", rfid: "RFID-9876", biometrics: false, biometricId: null, role: "User" },
  ]);

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricPlaceholder, setBiometricPlaceholder] = useState("");


  {/* Biometric modal functionality */}
  const openBiometricModal = (user) => {
    setSelectedUser(user);
    setBiometricPlaceholder(user.biometricId || "");
    setShowBiometricModal(true);
  };

  const closeBiometricModal = () => {
    setSelectedUser(null);
    setBiometricPlaceholder("");
    setShowBiometricModal(false);
  };

  // Simulate saving/changing biometric: set biometrics true and set an id
  const saveBiometric = (biometricId) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? { ...u, biometrics: true, biometricId: biometricId || `BIO-${Date.now()}` }
          : u
      )
    );
    closeBiometricModal();
  };
  
  {/* Filter users based on search input */}
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-4xl font-semibold">Użytkownicy</h2>
        <input
          type="text"
          placeholder="🔍 Wyszukaj użytkownika"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl shadow-lg border border-gray-300 overflow-hidden">
        <table className="w-full bg-white text-center">
          <thead className="bg-gray-100 text-gray-700 text-sm uppercase">
            <tr>
              <th className="p-3">Imię i nazwisko</th>
              <th className="p-3">Email</th>
              <th className="p-3">RFID</th>
              <th className="p-3">Biometria</th>
              <th className="p-3">Rola</th>
              <th className="p-3">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.rfid || "Nie przypisano"}</td>
                  <td className="p-3">
                    {u.biometrics ? (
                      <span className="text-green-600 font-semibold">✔️</span>
                    ) : (
                      <span className="text-red-500 font-semibold">❌</span>
                    )}
                  </td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3 space-x-2">

                    <button
                      onClick={() => openBiometricModal(u)}
                      className="text-green-600 hover:underline"
                    >
                      {u.biometrics ? "Zmień biometrię" : "Dodaj biometrię"}
                    </button>

                    <button
                      onClick={() =>
                        setUsers((prev) => prev.filter((item) => item.id !== u.id))
                      }
                      className="text-red-600 hover:underline"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-6 text-gray-500 italic">
                  Brak wyników dla: <b>{search}</b>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Biometric modal */}
      {showBiometricModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4 text-center">
              {selectedUser.biometrics ? "Zmień biometrię dla" : "Dodaj biometrię dla"}{" "}
              {selectedUser.name}
            </h3>

            <div className="mb-4">
              <input
                type="text"
                value={biometricPlaceholder}
                onChange={(e) => setBiometricPlaceholder(e.target.value)}
                placeholder="Wpisz identyfikator biometryczny lub zeskanuj..."
                className="w-full border rounded-lg p-2 text-center"
              />
              <p className="text-sm text-gray-500 mt-2 text-center">
                Możesz wpisać ID lub zostawić puste, aby wygenerować nowe.
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={closeBiometricModal}
                className="px-4 py-2 rounded-lg border"
              >
                Anuluj
              </button>
              <button
                onClick={() => saveBiometric(biometricPlaceholder)}
                className="px-4 py-2 rounded-lg bg-green-600 text-white"
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Helper form component for RFID (keeps Users component cleaner) */
function RFIDForm({ initialValue, onCancel, onSave }) {
  const [value, setValue] = useState(initialValue || "");

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Wpisz lub zeskanuj RFID"
        className="w-full border rounded-lg p-2 mb-4 text-center"
      />
      <div className="flex justify-end space-x-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border">
          Anuluj
        </button>
        <button
          onClick={() => onSave(value)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white"
        >
          Zapisz
        </button>
      </div>
    </>
  );
}
