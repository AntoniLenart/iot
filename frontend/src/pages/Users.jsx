import { useState, useEffect } from "react";
import { getConfig } from "../../src/config";

const { SERVER_ENDPOINT, ACCESS_ENDPOINT } = getConfig()

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isReadingBiometric, setIsReadingBiometric] = useState(false);
  const [isReadingRfid, setIsReadingRfid] = useState(false);
  const [isRfid, setIsRfid] = useState(false);
  const [currRfidCredId, setCurrRfidCredId] = useState(null);
  const [currBiomCredId, setCurrBiomCredId] = useState(null);
  const [isBiom, setIsBiom] = useState(false);
  const [rfidBiomLoaded, setRfidBiomLoaded] = useState(false);

  // Fetch users from the database on component mount
  const fetchUsers = async () => {
    try {
      const response = await fetch(SERVER_ENDPOINT + '/api/v1/users/list');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) setCurrentUserId(user.user_id);
  }, []);

  // Search filter
  const filteredUsers = users.filter(
    (u) =>
      u.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.rfid?.toLowerCase().includes(search.toLowerCase())
  );

  // Opening modal
  const openUserModal = (user) => {
    setSelectedUser({ ...user });
  };

  useEffect(() => {
  if (selectedUser && !rfidBiomLoaded) {
    const fetchRfid = async () => {
      await getInitialIds();
      setRfidBiomLoaded(true);
    };
    fetchRfid();
  }
  }, [selectedUser, rfidBiomLoaded]);

  const closeUserModal = () => {
    setSelectedUser(null);
    setShowDeleteConfirm(false);
    setRfidBiomLoaded(false);
    setIsBiom(false);
    setIsRfid(false);
  };

  // Saves changes with API call
  const saveUserChanges = async (fields) => {
    console.log(fields)

    setActionLoading(true);
    try {
      const response = await fetch(SERVER_ENDPOINT + '/api/v1/users/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.user_id, ...fields }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      console.log(isRfid)
      if(fields.rfid && !isRfid)
      {
        try {
        const response = await fetch(SERVER_ENDPOINT + '/api/v1/credentials/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: selectedUser.user_id, credential_type: 'rfid_card', identifier: selectedUser.rfid, issued_by: JSON.parse(localStorage.getItem('user')).user_id, is_active: true, ...fields }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update credentials (rfid)');
        }
        } catch (err) {
          alert(`Error updating credentials (rfid): ${err.message}`);
        }
      }

      if(fields.rfid && isRfid)
      {
        console.log(currRfidCredId);
        try {
          const response = await fetch(SERVER_ENDPOINT + '/api/v1/credentials/update', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: selectedUser.user_id, credential_id: currRfidCredId, identifier: selectedUser.rfid, issued_by: JSON.parse(localStorage.getItem('user')).user_id, is_active: true, ...fields }),
          });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update credentials (rfid)');
        }
        } catch (err) {
        alert(`Error updating credentials (rfid): ${err.message}`);
        } 
      }

      if(fields.biometricId && !isBiom)
      {
        try {
        const response = await fetch(SERVER_ENDPOINT + '/api/v1/credentials/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: selectedUser.user_id, credential_type: 'fingerprint', identifier: selectedUser.biometricId, issued_by: JSON.parse(localStorage.getItem('user')).user_id, is_active: true, ...fields }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update credentials (fingerprint)');
        }
        } catch (err) {
          alert(`Error updating credentials (fingerprint): ${err.message}`);
        }
      }
      
      console.log(isBiom)
      if(fields.biometricId && isBiom)
      {
        console.log(currBiomCredId);
        try {
          const response = await fetch(SERVER_ENDPOINT + '/api/v1/credentials/update', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: selectedUser.user_id, credential_id: currBiomCredId, identifier: selectedUser.biometricId, issued_by: JSON.parse(localStorage.getItem('user')).user_id, is_active: true, ...fields }),
          });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update credentials (fingerprint)');
        }
        } catch (err) {
        alert(`Error updating credentials (fingerprint): ${err.message}`);
        } 
      }

      await fetchUsers(); // Refresh list
      closeUserModal();
    } catch (err) {
      alert(`Error updating user: ${err.message}`);
    } finally {
      setActionLoading(false);
    }

  };

  // Deletes user (API call)
  const deleteUser = async (user_id) => {
    setActionLoading(true);
    try {
      const response = await fetch(SERVER_ENDPOINT + '/api/v1/users/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
      await fetchUsers(); // Refresh list
      closeUserModal();
    } catch (err) {
      alert(`Error deleting user: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  const getInitialIds =  async () => {

    let user_id, rfidId, biomId

    try {
      const params = new URLSearchParams({
        user_id: selectedUser.user_id,
        type: 'rfid_card'
      });

      const response = await fetch(SERVER_ENDPOINT + `/api/v1/credentials/getByUserId?${params.toString()}`);
      const data = await response.json()
      rfidId = data?.credential?.identifier || "";
      setCurrRfidCredId(data?.credential?.credential_id || null);
      if(rfidId) {setIsRfid(true)}

    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }

    try {
      const params = new URLSearchParams({
        user_id: selectedUser.user_id,
        type: 'fingerprint'
      });

      const response = await fetch(SERVER_ENDPOINT + `/api/v1/credentials/getByUserId?${params.toString()}`);
      const data = await response.json()
      biomId = data?.credential?.identifier || "";
      setCurrBiomCredId(data?.credential?.credential_id || null);
      if(biomId) {setIsBiom(true)}
      

    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }

    setSelectedUser((prev) => ({
      ...prev,
      rfid: rfidId || "",
      biometricId: biomId || ""
     }));


    return null;
  }

  const handleRfidRead = async () => {
    setIsReadingRfid(true);

    try {
      await fetch(ACCESS_ENDPOINT + "/enroll/start", {
        method: "POST",
      });

      const eventSource = new EventSource(ACCESS_ENDPOINT + "/frontend/rfid");

      const timeout = setTimeout(() => {
        console.log("Timeout - no RFID data received");
        eventSource.close();
        setIsReadingRfid(false);
      }, 30000);

      eventSource.onmessage = (event) => {
        clearTimeout(timeout);

        const rfid = JSON.parse(event.data);
        console.log("Received RFID:", rfid);

        // Update the input value
        setSelectedUser((prev) => ({
          ...prev,
          rfid: rfid.data || "",
        }));

        eventSource.close();
        setIsReadingRfid(false);
      };

      eventSource.onerror = () => {
        clearTimeout(timeout);
        eventSource.close();
        setIsReadingRfid(false);
      };
    } catch (err) {
      console.error("Error starting enroll:", err);
      setIsReadingRfid(false);
    }
  }

  const handleBiometricRead = async() => {
    setIsReadingBiometric(true)

    try {
      await fetch(ACCESS_ENDPOINT + "/enroll/start", {
        method: "POST",
      });

        const eventSource = new EventSource(ACCESS_ENDPOINT + "/frontend/biometric");

        const timeout = setTimeout(() => {
            console.log("Timeout - no biometric data received")
            eventSource.close()
            setIsReadingBiometric(false)
        }, 30000)

        eventSource.onmessage = (event) => {
          clearTimeout(timeout)

          const biometry = JSON.parse(event.data)
          console.log(biometry.data)

          setSelectedUser((prev) => ({
          ...prev,
          biometricId: biometry.data || "",
          }));

          eventSource.close();
          setIsReadingBiometric(false);
        }

        eventSource.onerror = () => {
          clearTimeout(timeout);
          eventSource.close();
          setIsReadingBiometric(false);
      };
    } catch (err) {
      console.error("Error starting enroll:", err);
      setIsReadingBiometric(false);
    }
    
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-4xl font-semibold">Użytkownicy</h2>
        <input
          type="text"
          placeholder="🔍 Wyszukaj po imieniu, nazwisku, emailu lub RFID"
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
              <th className="p-3 hidden md:table-cell">Adres e-mail</th>
              <th className="p-3">RFID</th>
              <th className="p-3">Biometria</th>
              <th className="p-3 hidden md:table-cell">Rola</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <tr
                  key={u.user_id}
                  className="border-b hover:bg-blue-50 cursor-pointer transition"
                  onClick={() => openUserModal(u)}
                >
                  <td className="p-3">{u.first_name} {u.last_name}</td>
                  <td className="p-3 hidden md:table-cell">{u.email || "Brak"}</td>
                  <td className="p-3">{u.rfid || "Nie przypisano"}</td>
                  <td className="p-3">
                    {u.biometrics ? (
                      <span className="text-green-600 font-semibold">✔️</span>
                    ) : (
                      <span className="text-red-500 font-semibold">❌</span>
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell">{u.user_type || "User"}</td>
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
                  value={`${selectedUser.first_name} ${selectedUser.last_name}`}
                  onChange={(e) => {
                    const [first, ...last] = e.target.value.split(' ');
                    setSelectedUser({ ...selectedUser, first_name: first, last_name: last.join(' ') });
                  }}
                  className="w-full border rounded-lg p-2 text-center"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={selectedUser.email || ""}
                  onChange={(e) => {
                    console.log(e.target.value)
                    setSelectedUser({ ...selectedUser, email: e.target.value })
                  }}
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
              <button
                  type="button"
                  onClick={handleRfidRead}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {isReadingRfid ? "Czytam..." : "Odczytaj"}
              </button>

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
                    })
                  }
                  placeholder="Wpisz identyfikator biometryczny"
                  className="w-full border rounded-lg p-2 text-center"
                />
              </div>

              <button
                  type="button"
                  onClick={handleBiometricRead}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                {isReadingBiometric ? "Czytam..." : "Odczytaj"}
              </button>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Rola</label>
                <select
                  value={selectedUser.user_type || "employee"}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, user_type: e.target.value })
                  }
                  className="w-full border rounded-lg p-2 text-center"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                  <option value="service">Service</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Zmiana hasła (pozostaw puste, aby nie zmieniać)
                </label>
                <input
                  type="password"
                  value={selectedUser.newPassword || ""}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, newPassword: e.target.value })
                  }
                  placeholder="Nowe hasło"
                  className="w-full border rounded-lg p-2 text-center"
                />
              </div>
            </div>

            <div className="flex items-center mt-6">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedUser.user_id === currentUserId || actionLoading}
                className="px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                🗑️ Usuń użytkownika
              </button>
              <div className="ml-auto space-x-2">
                <button
                  onClick={closeUserModal}
                  className="px-4 py-2 rounded-lg border"
                  disabled={actionLoading}
                >
                  Anuluj
                </button>
                <button
                  onClick={() => {
                    const { newPassword, ...userData } = selectedUser;
                    if (newPassword) userData.password = newPassword;
                    saveUserChanges(userData);
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? "Zapisywanie..." : "Zapisz zmiany"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal potwierdzenia usunięcia */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-semibold mb-3 text-center">
              Potwierdź usunięcie
            </h4>
            <p className="text-sm text-gray-700 mb-4 text-center">
              Czy na pewno chcesz usunąć tego użytkownika? Tego nie można cofnąć.
            </p>

            <div className="bg-gray-50 border rounded-xl p-3 mb-5 text-sm">
              <div className="font-semibold">{selectedUser?.first_name} {selectedUser?.last_name}</div>
              <div className="text-gray-600">{selectedUser?.email}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border"
                disabled={actionLoading}
              >
                Anuluj
              </button>
              <button
                onClick={async () => {
                  setActionLoading(true);
                  try {
                    const response = await fetch(SERVER_ENDPOINT + '/api/v1/users/remove', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: selectedUser.user_id }),
                    });
                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Failed to delete user');
                    }
                    await fetchUsers(); // Refresh list
                    closeUserModal();
                  } catch (err) {
                    alert(`Error deleting user: ${err.message}`);
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={selectedUser.user_id === currentUserId || actionLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {actionLoading ? "Usuwanie..." : "Tak, usuń"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
