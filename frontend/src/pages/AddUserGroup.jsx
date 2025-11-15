import { useState, useEffect } from "react";

export default function UserGroupsPage() {
  const [rooms, setRooms] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("group");
  const [groupFormData, setGroupFormData] = useState({ name: "", description: "" });
  const [roomFormData, setRoomFormData] = useState({ group_id: "", room_name: "" });
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchRooms = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/v1/rooms/list');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/v1/user_groups/list');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setGroups(data.user_groups || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    fetchRooms();
    fetchGroups();
  }, [refreshTrigger]);

  // Optional automatic refresh -> 30seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleGroupChange = (e) => {
    setGroupFormData({ ...groupFormData, [e.target.name]: e.target.value });
  };

  const handleRoomChange = (e) => {
    setRoomFormData({ ...roomFormData, [e.target.name]: e.target.value });
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

   try {
      // First, create a credential for RFID
      const groupResponse = await fetch("http://localhost:4000/api/v1/user_groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupFormData.name,
          description: groupFormData.description
        }),
      });

      if (!groupResponse.ok) {
        const errorData = await groupResponse.json();
        throw new Error(errorData.error || "Nie udało się utworzyć poświadczenia");
      }

      const data = await groupResponse.json();
      setMessage("Grupa dostępowa utworzona pomyślnie!");
      setGroupFormData({
        name: "",
        description: ""
      })

      setRefreshTrigger(prev => prev + 1);

    } catch (error) {
      setMessage(`Błąd: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRoomSubmit = (e) => {
    e.preventDefault();
    // TODO: logika dodawania pokoju
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-4xl font-semibold mb-6">Dodaj grupę / pokój</h2>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.includes("Błąd") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`py-2 px-4 ${
            activeTab === "group" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
          }`}
          onClick={() => setActiveTab("group")}
        >
          Grupa
        </button>
        <button
          className={`py-2 px-4 ${
            activeTab === "room" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
          }`}
          onClick={() => setActiveTab("room")}
        >
          Pokój
        </button>
      </div>

      {/* Group Tab */}
      {activeTab === "group" && (
        <form onSubmit={handleGroupSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nazwa grupy *</label>
            <input
              type="text"
              name="name"
              value={groupFormData.name}
              onChange={handleGroupChange}
              required
              placeholder="Wprowadź nazwę grupy"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Opis</label>
            <input
              type="text"
              name="description"
              value={groupFormData.description}
              onChange={handleGroupChange}
              required
              placeholder="Wprowadź opis grupy dostępowej"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Tworzenie..." : "Dodaj grupę"}
          </button>
        </form>
      )}

      {/* Room Tab */}
      {activeTab === "room" && (
        <form onSubmit={handleRoomSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Wybierz grupę *</label>
            <select
              name="group_id"
              value={roomFormData.group_id}
              onChange={handleRoomChange}
              required
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Wybierz grupę</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nazwa pokoju *</label>
            <input
              type="text"
              name="room_name"
              value={roomFormData.room_name}
              onChange={handleRoomChange}
              required
              placeholder="Wprowadź nazwę pokoju"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Dodawanie..." : "Dodaj pokój"}
          </button>
        </form>
      )}
    </div>
  );
}
