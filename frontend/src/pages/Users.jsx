import { useState } from "react";

export default function Users() {
  const [users, setUsers] = useState([
    {
      id: 1,
      name: "Jan Kowalski",
      email: "jan@example.com",
      rfid: "RFID-1234",
      biometrics: true,
      biometricId: "BIO-01",
      role: "Admin",
    },
    {
      id: 2,
      name: "Anna Nowak",
      email: "anna@example.com",
      rfid: null,
      biometrics: false,
      biometricId: null,
      role: "User",
    },
    {
      id: 3,
      name: "Piotr Zieliński",
      email: "piotr@example.com",
      rfid: "RFID-9876",
      biometrics: false,
      biometricId: null,
      role: "User",
    },
  ]);

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  // Search filter
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.rfid && u.rfid.toLowerCase().includes(search.toLowerCase()))
  );

  // Opening modal
  const openUserModal = (user) => {
    setSelectedUser({ ...user });
  };

  const closeUserModal = () => {
    setSelectedUser(null);
  };

  // Saves changes
  const saveUserChanges = () => {
    setUsers((prev) =>
      prev.map((u) => (u.id === selectedUser.id ? selectedUser : u))
    );
    closeUserModal();
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-4xl font-semibold">Użytkownicy</h2>
        <input
          type="text"
          placeholder="🔍 Wyszukaj po imieniu lub RFID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* User table */}
      <div className="rounded-xl shadow-lg border border-gray-300 overflow-hidden">
        <table className="w-full bg-white text-center">
          <thead className="bg-gray-100 text-gray-700 text-sm uppercase">
            <tr>
              <th className="p-3">Imię i nazwisko</th>
              <th className="p-3 hidden md:table-cell">Email</th> {/* hidden on small screens */}
              <th className="p-3">RFID</th>
              <th className="p-3">Biometria</th>
              <th className="p-3 hidden md:table-cell">Rola</th> {/* hidden on small screens */}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className="border-b hover:bg-blue-50 cursor-pointer transition"
                  onClick={() => openUserModal(u)}
                >
                  <td className="p-3">{u.name}</td>
                  <td className="p-3 hidden md:table-cell">{u.email}</td> {/* hidden on small screens */}
                  <td className="p-3">{u.rfid || "Nie przypisano"}</td>
                  <td className="p-3">
                    {u.biometrics ? (
                      <span className="text-green-600 font-semibold">✔️</span>
                    ) : (
                      <span className="text-red-500 font-semibold">❌</span>
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell">{u.role}</td> {/* hidden on small screens */}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-6 text-gray-500 italic">
                  Brak wyników dla: <b>{search}</b>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User modal edit */}
      {selectedUser && (
          <div
            className="fixed inset-0 backdrop-blur-md bg-white/20 flex items-center justify-center z-50 transition"
            onClick={closeUserModal}
          >
            <div
              className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
            <h3 className="text-xl font-semibold mb-4 text-center">
              Edytuj dane użytkownika
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Imię i nazwisko
                </label>
                <input
                  type="text"
                  value={selectedUser.name}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, name: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-center"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={selectedUser.email}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, email: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-center"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">RFID</label>
                <input
                  type="text"
                  value={selectedUser.rfid || ""}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, rfid: e.target.value })
                  }
                  placeholder="Wpisz lub zeskanuj RFID"
                  className="w-full border rounded-lg p-2 text-center"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Biometria
                </label>
                <input
                  type="text"
                  value={selectedUser.biometricId || ""}
                  onChange={(e) =>
                    setSelectedUser({
                      ...selectedUser,
                      biometricId: e.target.value,
                      biometrics: !!e.target.value,
                    })
                  }
                  placeholder="Wpisz identyfikator biometryczny"
                  className="w-full border rounded-lg p-2 text-center"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Rola</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, role: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-center"
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={closeUserModal}
                className="px-4 py-2 rounded-lg border"
              >
                Anuluj
              </button>
              <button
                onClick={saveUserChanges}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white"
              >
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
