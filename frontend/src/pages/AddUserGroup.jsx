import { useState, useEffect } from "react";
import { getConfig } from "../../src/config";

const { SERVER_ENDPOINT } = getConfig();

export default function UserGroupsPage() {
  const [rooms, setRooms] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("group");
  const [groupFormData, setGroupFormData] = useState({
    name: "",
    description: ""
  });

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [roomFormData, setRoomFormData] = useState({ room_id: "" });
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [weekDays, setWeekDays] = useState({
    mon: false,
    tue: false,
    wed: false,
    thu: false,
    fri: false,
    sat: false,
    sun: false
  });
  const [hours, setHours] = useState({
    time_from: "",
    time_to: ""
  });

  const fetchRooms = async () => {
    try {
      const response = await fetch(SERVER_ENDPOINT + "/api/v1/rooms/list");
      if (!response.ok) throw new Error("Nie udało się pobrać listy pokoi");
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
      const response = await fetch(SERVER_ENDPOINT + "/api/v1/user_groups/list");
      if (!response.ok) throw new Error("Nie udało się pobrać listy grup");
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

  // Optional automatic refresh -> 30 seconds
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

  const handleHoursChange = (e) => {
    setHours({ ...hours, [e.target.name]: e.target.value });
  };

  const toggleDay = (day) => {
    setWeekDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const handleAddRoom = () => {
    if (!roomFormData.room_id) return;
    const room = rooms.find((r) => r.room_id === roomFormData.room_id);
    if (!room) return;

    if (selectedRooms.some((r) => r.room_id === room.room_id)) {
      setRoomFormData({ ...roomFormData, room_id: "" });
      return;
    }

    setSelectedRooms((prev) => [...prev, room]);
    setRoomFormData({ ...roomFormData, room_id: "" });
  };

  const handleRemoveRoom = (room_id) => {
    setSelectedRooms((prev) => prev.filter((r) => r.room_id !== room_id));
  };

 
  const loadGroupData = async (group_id) => {
    if (!group_id) {
      setEditingGroupId(null);
      setGroupFormData({ name: "", description: "" });
      setSelectedRooms([]);
      setWeekDays({
        mon: false, tue: false, wed: false, thu: false,
        fri: false, sat: false, sun: false
      });
      setHours({ time_from: "", time_to: "" });
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${SERVER_ENDPOINT}/api/v1/user_groups/${group_id}`);
      if (!response.ok) throw new Error("Nie udało się pobrać danych grupy");

      const data = await response.json();

      setEditingGroupId(group_id);

      setGroupFormData({
        name: data.name || "",
        description: data.description || ""
      });

      // pokoje przychodzą jako lista nazw -> zamieniamy na obiekty
      const roomObjects = (data.rooms || [])
        .map(roomName => rooms.find(r => r.name === roomName))
        .filter(Boolean);
      setSelectedRooms(roomObjects);

      // dni jako tablica -> konwersja do obiektu checkboxów
      const daysObj = {
        mon: false, tue: false, wed: false, thu: false,
        fri: false, sat: false, sun: false
      };
      (data.days || []).forEach(d => {
        if (daysObj.hasOwnProperty(d)) daysObj[d] = true;
      });
      setWeekDays(daysObj);

      setHours({
        time_from: data.time_from || "",
        time_to: data.time_to || ""
      });

    } catch (err) {
      setMessage("Błąd: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        name: groupFormData.name,
        description: groupFormData.description,
        rooms: selectedRooms.map((r) => r.name),
        days: Object.entries(weekDays)
          .filter(([_, v]) => v)
          .map(([k]) => k),
        time_from: hours.time_from,
        time_to: hours.time_to
      };

      const response = await fetch(SERVER_ENDPOINT + "/api/v1/user_groups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Nie udało się utworzyć grupy");
      }

      await response.json();
      setMessage("Grupa utworzona pomyślnie!");

      setGroupFormData({ name: "", description: "" });
      setSelectedRooms([]);
      setWeekDays({
        mon: false, tue: false, wed: false, thu: false,
        fri: false, sat: false, sun: false
      });
      setHours({ time_from: "", time_to: "" });

      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setMessage("Błąd: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!editingGroupId) {
      setMessage("Najpierw wybierz grupę do edycji.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const payload = {
        name: groupFormData.name,
        description: groupFormData.description,
        rooms: selectedRooms.map((r) => r.name), // <-- NAZWY pokoi
        days: Object.entries(weekDays)
          .filter(([_, v]) => v)
          .map(([k]) => k),
        time_from: hours.time_from,
        time_to: hours.time_to
      };

      const response = await fetch(`${SERVER_ENDPOINT}/api/v1/user_groups/${editingGroupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Nie udało się zapisać zmian");
      }

      await response.json();
      setMessage("Zmiany zapisane pomyślnie!");

      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setMessage("Błąd: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!editingGroupId) {
      setMessage("Najpierw wybierz grupę do usunięcia.");
      return;
    }

    const confirmDelete = window.confirm("Czy na pewno chcesz usunąć tę grupę?");
    if (!confirmDelete) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${SERVER_ENDPOINT}/api/v1/user_groups/${editingGroupId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Nie udało się usunąć grupy");
      }

      await response.json();
      setMessage("Grupa została usunięta.");

      // reset formularza
      setEditingGroupId(null);
      setGroupFormData({ name: "", description: "" });
      setSelectedRooms([]);
      setWeekDays({
        mon: false, tue: false, wed: false, thu: false,
        fri: false, sat: false, sun: false
      });
      setHours({ time_from: "", time_to: "" });

      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setMessage("Błąd: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-4xl font-semibold mb-6">Dodaj / edytuj grupę</h2>

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
          onClick={() => {
            setActiveTab("group");
            setEditingGroupId(null);
          }}
        >
          Dodaj
        </button>
        <button
          className={`py-2 px-4 ${
            activeTab === "room" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
          }`}
          onClick={() => setActiveTab("room")}
        >
          Edytuj
        </button>
      </div>

      {/* --- CREATE (Dodaj) Tab: pełny formularz --- */}
      {activeTab === "group" && (
        <form onSubmit={handleCreateGroup} className="space-y-4">
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
              placeholder="Wprowadź opis grupy dostępowej"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Pokoje */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Dodaj pokój</label>
            <div className="flex gap-2">
              <select
                name="room_id"
                value={roomFormData.room_id}
                onChange={handleRoomChange}
                className="w-full border rounded-lg p-2"
              >
                <option value="">Wybierz pokój</option>
                {rooms.map((r) => (
                  <option key={r.room_id} value={r.room_id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleAddRoom}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Dodaj
              </button>
            </div>

            {/* Selected room badges */}
            {selectedRooms.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Wybrane pokoje:</h4>
                <div className="flex flex-wrap mt-2 gap-2">
                  {selectedRooms.map((r) => (
                    <div
                      key={r.room_id}
                      className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                    >
                      <span>{r.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRoom(r.room_id)}
                        className="ml-2 text-blue-800 font-bold"
                        aria-label={`Usuń ${r.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dni tygodnia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dni obowiązywania</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(weekDays).map((day) => (
                <label key={day} className="flex items-center gap-2">
                  <input type="checkbox" checked={weekDays[day]} onChange={() => toggleDay(day)} />
                  {day.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          {/* Godziny */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Od *</label>
              <input
                type="time"
                name="time_from"
                value={hours.time_from}
                onChange={handleHoursChange}
                required
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Do *</label>
              <input
                type="time"
                name="time_to"
                value={hours.time_to}
                onChange={handleHoursChange}
                required
                className="w-full border rounded-lg p-2"
              />
            </div>
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

      {activeTab === "room" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Wybierz grupę do edycji</label>
            <select
              onChange={(e) => {
                const gid = e.target.value;
                if (!gid) {
                  setEditingGroupId(null);
                  setGroupFormData({ name: "", description: "" });
                  setSelectedRooms([]);
                  setWeekDays({
                    mon: false,
                    tue: false,
                    wed: false,
                    thu: false,
                    fri: false,
                    sat: false,
                    sun: false
                  });
                  setHours({ time_from: "", time_to: "" });
                  return;
                }
                loadGroupData(gid);
              }}
              className="w-full border rounded-lg p-2"
            >
              <option value="">Wybierz grupę</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Jeśli wczytano grupę do edycji — pokazujemy edytowalny formularz */}
          {editingGroupId ? (
            <form onSubmit={handleSaveGroup} className="space-y-4">
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
                  placeholder="Wprowadź opis grupy dostępowej"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Pokoje */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Dodaj pokój</label>
                <div className="flex gap-2">
                  <select
                    name="room_id"
                    value={roomFormData.room_id}
                    onChange={handleRoomChange}
                    className="w-full border rounded-lg p-2"
                  >
                    <option value="">Wybierz pokój</option>
                    {rooms.map((r) => (
                      <option key={r.room_id} value={r.room_id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleAddRoom}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg"
                  >
                    Dodaj
                  </button>
                </div>

                {/* Selected room badges */}
                {selectedRooms.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Wybrane pokoje:</h4>
                    <div className="flex flex-wrap mt-2 gap-2">
                      {selectedRooms.map((r) => (
                        <div
                          key={r.room_id}
                          className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                        >
                          <span>{r.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRoom(r.room_id)}
                            className="ml-2 text-blue-800 font-bold"
                            aria-label={`Usuń ${r.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dni tygodnia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dni obowiązywania</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.keys(weekDays).map((day) => (
                    <label key={day} className="flex items-center gap-2">
                      <input type="checkbox" checked={weekDays[day]} onChange={() => toggleDay(day)} />
                      {day.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>

              {/* Godziny */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Od *</label>
                  <input
                    type="time"
                    name="time_from"
                    value={hours.time_from}
                    onChange={handleHoursChange}
                    required
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Do *</label>
                  <input
                    type="time"
                    name="time_to"
                    value={hours.time_to}
                    onChange={handleHoursChange}
                    required
                    className="w-full border rounded-lg p-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Zapisywanie..." : "Zapisz zmiany"}
              </button>
              {editingGroupId && (
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  className="w-full mt-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                >
                  Usuń grupę
                </button>
              )}
            </form>
          ) : (
            <div className="text-sm text-gray-600">Wybierz grupę powyżej, aby edytować jej ustawienia.</div>
          )}
        </div>
      )}
    </div>
  );
}
