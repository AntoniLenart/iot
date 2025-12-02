import FloorPlan from "../components/FloorPlan";
import { useState, useEffect } from "react";
import { useAuth } from "../components/AuthContext";
import { getConfig } from "../../src/config";

const { SERVER_ENDPOINT } = getConfig()

export default function Rooms() {
  const { user } = useAuth();
  const isAdmin = user?.user_type === "admin";

  const [svgIds, setSvgIds] = useState([]);
  const [hoveredRoomId, setHoveredRoomId] = useState(null);

  const [roomNames, setRoomNames] = useState(() =>
    JSON.parse(localStorage.getItem("room_names") || "{}")
  );
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [roomStatus, setRoomStatus] = useState(() =>
    JSON.parse(localStorage.getItem("room_reservations") || "{}")
  );
  const [activeFloorId, setActiveFloorId] = useState(() =>
    localStorage.getItem("active_floor_id")
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [roomForReservation, setRoomForReservation] = useState(null);

  const [svgMarkup, setSvgMarkup] = useState(() => {
    const savedPlans = JSON.parse(localStorage.getItem("floor_plans") || "[]");
    const activeId = localStorage.getItem("active_floor_id");
    const activePlan = savedPlans.find((p) => p.id === activeId) || savedPlans[0];
    return activePlan ? activePlan.svg : null;
  });


  // Load floor plans on mount
  useEffect(() => {

  // >>> BACKEND: TU powinna być lista planów GET /api/floors
  // fetch(SERVER_ENDPOINT + '/api/floors')
  const savedPlans = JSON.parse(localStorage.getItem("floor_plans") || "[]");
  const activeId = localStorage.getItem("active_floor_id");

  if (savedPlans.length > 0) {

    const activePlan =
      savedPlans.find((p) => p.id === activeId) || savedPlans[0];
    if (activePlan) setSvgMarkup(activePlan.svg);
  }
}, []);

  useEffect(() => {
    localStorage.setItem("room_names", JSON.stringify(roomNames));
  }, [roomNames]);

  useEffect(() => {
    localStorage.setItem("room_reservations", JSON.stringify(roomStatus));
  }, [roomStatus]);

  // nowe use effecty
  useEffect(() => {
    // >>> BACKEND: TU pobierasz listę pokoi dla piętra
    // fetch(SERVER_ENDPOINT + `/api/rooms/${activeFloorId}`)
  }, [activeFloorId]);

  useEffect(() => {
    // >>> BACKEND: TU pobierasz rezerwacje pokoju (GET /api/reservations/{floor_id})
    // fetch(SERVER_ENDPOINT + `/api/reservations/${activeFloorId}`)
  }, [activeFloorId]);

  useEffect(() => {
    // >>> BACKEND: TU wysyłasz listę ID pokoi (svg_room_id)
    // POST /api/rooms/{floor_id}/discover
  }, [svgIds, activeFloorId]);


  // Handle uploading multiple SVG floor plans
  const handleUploadMany = async (e) => {

    // >>> BACKEND: TU wysyłasz SVG do backendu (POST /api/floors)
    // const res = await fetch(SERVER_ENDPOINT + '/api/floors', {...})
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const existing = JSON.parse(localStorage.getItem("floor_plans") || "[]");

    const loaded = await Promise.all(
      files.map(async (file) => {
        const svg = await file.text();
        return {
          id: `${file.name}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          name: file.name,
          svg,
        };
      })
    );

    const merged = [...existing, ...loaded];
    localStorage.setItem("floor_plans", JSON.stringify(merged));

    const newActive = merged[merged.length - loaded.length].id;
    localStorage.setItem("active_floor_id", newActive);

    setSvgMarkup(loaded[0].svg);
    setActiveFloorId(newActive);

    window.dispatchEvent(new Event("floorplans-updated"));

};

  // Remove currently active plan
  const handleResetPlan = () => {
    // >>> BACKEND: TU usuwasz plan piętra (DELETE /api/floors/${activeFloorId}`)
    const activeId = localStorage.getItem("active_floor_id");
    const savedPlans = JSON.parse(localStorage.getItem("floor_plans") || "[]");
    const updatedPlans = savedPlans.filter((p) => p.id !== activeId);

    const roomNames = JSON.parse(localStorage.getItem("room_names") || "{}");
    const roomReservations = JSON.parse(localStorage.getItem("room_reservations") || "{}");

    const filteredNames = {};
    const filteredReservations = {};

    Object.keys(roomNames).forEach(key => {
      if (!key.startsWith(activeId + ":")) {
        filteredNames[key] = roomNames[key];
      }
    });

    Object.keys(roomReservations).forEach(key => {
      if (!key.startsWith(activeId + ":")) {
        filteredReservations[key] = roomReservations[key];
      }
    });

    localStorage.setItem("room_names", JSON.stringify(filteredNames));
    localStorage.setItem("room_reservations", JSON.stringify(filteredReservations));

    const reservations = JSON.parse(localStorage.getItem("reservations") || "{}");

    const filteredUserReservations = {};
    Object.keys(reservations).forEach(userEmail => {
      const r = reservations[userEmail];
      if (r.floor_id !== activeId) {
        filteredUserReservations[userEmail] = r;
      }
    });

    localStorage.setItem("reservations", JSON.stringify(filteredUserReservations));

    localStorage.setItem("floor_plans", JSON.stringify(updatedPlans));

    if (updatedPlans.length > 0) {
      const next = updatedPlans[0];
      setSvgMarkup(next.svg);
      localStorage.setItem("active_floor_id", next.id);
      setActiveFloorId(next.id);
    } else {
      setSvgMarkup(null);
      localStorage.removeItem("active_floor_id");
      setActiveFloorId(null);
    }

    window.dispatchEvent(new Event("floorplans-updated"));
  };


  return (
  <div className="p-4 flex flex-col gap-6 items-start">
    <div className="flex flex-row justify-center gap-6 items-start w-full">
    {/* Left side — floor plan preview */}
<div
  className="bg-white p-2 rounded-lg shadow overflow-hidden select-none flex justify-center items-center"
  style={{
    width: "100%",
    maxWidth: "800px",
    height: "65vh",
    minHeight: "500px",
  }}
>
  {svgMarkup ? (
    <div className="w-full h-full flex justify-center items-center svg-wrapper">
      <FloorPlan
    key={activeFloorId + ":" + (svgMarkup ? svgMarkup.length : 0)}
    svgMarkup={svgMarkup}
    onIdsDetected={setSvgIds}
    hoveredRoomId={hoveredRoomId}
    roomStatus={roomStatus}
    activeFloorId={activeFloorId}
/>
    </div>
  ) : (
    <p className="text-gray-500">Brak wczytanego planu piętra</p>
  )}
</div>

    {/* Right side — room actions + floor list */}
    <div className="w-[400px] flex flex-col justify-between h-[65vh]">

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2">
      {svgIds.map(id => {
        const key = `${activeFloorId}:${id}`;
        const isThisBusy = roomStatus[key] === "busy";

        const reservations = JSON.parse(localStorage.getItem("reservations") || "{}");
        const userHasReservation = reservations[user.email] !== undefined;


        return roomNames[key] && (
          <button
            key={id}
            disabled={
              (userHasReservation && !isThisBusy) || 
              (isThisBusy && reservations[user?.email]?.room_id !== id)
            }
            onClick={() => {
              const key = `${activeFloorId}:${id}`;
              const roomName = roomNames[key];

              const reservations = JSON.parse(localStorage.getItem("reservations") || "{}");
              const userAlreadyHasRoom = reservations[user.email] !== undefined;

              // User can't book second room
              if (userAlreadyHasRoom && roomStatus[key] === "free") {
                alert("Masz już aktywną rezerwację. Usuń ją, zanim zarezerwujesz kolejny pokój.");
                return;
              }

              setRoomForReservation({ id, key, roomName });
              setModalOpen(true);
            }}
            className={`px-3 py-2 text-sm rounded font-medium transition
              ${roomStatus[key] === "free"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
              }
              ${userHasReservation && !isThisBusy ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            {roomStatus[key] === "free" ? (
              `Zarezerwuj ${roomNames[key]}`
            ) : reservations[user.email]?.room_id === id ? (
              `Usuń rezerwację ${roomNames[key]}`
            ) : (
              `Pokój zajęty przez ${reservations[Object.keys(reservations).find(
                mail => reservations[mail]?.room_id === id
              )]?.user_name || "nieznanego użytkownika"}`
            )}
          </button>
        );
      })}
    </div>

    <div className="pt-3">
      <FloorList setSvgMarkup={setSvgMarkup} setActiveFloorId={setActiveFloorId}/>
    </div>
  </div>

  {/* Admin section — room list and name editing */}
  {isAdmin && svgMarkup && (
  <div className="w-1/2 mt-10 p-5 bg-white rounded shadow border text-sm">
    <h2 className="text-2xl font-bold mb-4 text-gray-900">Sekcja dla administratora</h2>
    <h3 className="text-lg font-semibold mb-3 text-gray-800">Przydział pomieszczeń</h3>

  {svgIds.length > 0 ? (
    <div className="flex flex-col gap-3">
      {[...svgIds].sort().map((id, index) => {
      const key = `${activeFloorId}:${id}`;

      return (
        <div
          key={id}
          className="p-3 bg-white rounded border flex flex-col gap-1"
          onMouseEnter={() => setHoveredRoomId(id)}
          onMouseLeave={() => setHoveredRoomId(null)}
          onClick={() => {
            setEditingRoomId(id);
            setEditingName(roomNames[key] || "");
          }}
        >
          <span className="font-medium">
            Pomieszczenie {index + 1} — ID:{" "}
            <span className="text-blue-600">{id}</span>
          </span>

          {roomNames[key] && (
            <span className="text-sm text-green-700">
              Nazwa: <b>{roomNames[key]}</b>
            </span>
          )}
        </div>
      );
    })}
        </div>
      ) : (
        <p className="text-gray-500 italic">
          Nie wykryto żadnych pomieszczeń w tym planie.
        </p>
      )}
    </div>
  )}

      {/* Popup for editing room names */}
      {editingRoomId && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg w-[320px]">
          <h2 className="text-lg font-semibold mb-4">Nazwij pokój</h2>

          <p className="text-sm text-gray-600 mb-3">
            Edytujesz pokój o ID: <b>{editingRoomId}</b>
          </p>

          <input
            type="text"
            className="w-full border rounded px-3 py-2 mb-4"
            placeholder="Wpisz nazwę pokoju..."
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
              onClick={() => setEditingRoomId(null)}
            >
              Anuluj
            </button>

            <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => {
              // >>> BACKEND: TU zapisujesz nazwę pokoju (PATCH /api/rooms/{room_id}`)
              const key = `${activeFloorId}:${editingRoomId}`;

              if (!editingName.trim()) {
                setRoomNames(prev => {
                  const updated = { ...prev };
                  delete updated[key];
                  return updated;
                });

                setRoomStatus(prev => {
                  const updated = { ...prev };
                  delete updated[key];
                  return updated;
                });

              } else {
                setRoomNames(prev => ({
                  ...prev,
                  [key]: editingName
                }));

                setRoomStatus(prev => ({
                  ...prev,
                  [key]: "free"
                }));
              }

              setEditingRoomId(null);
            }}
          >
            Zapisz
          </button>
          </div>
        </div>
      </div>
    )}

    {/*Popup for reservation details */}
    <ReservationModal
      isOpen={modalOpen}
      onClose={() => setModalOpen(false)}
      user={user}
      roomName={roomForReservation?.roomName || ""}
      isBusy={roomStatus[roomForReservation?.key] === "busy"}

      existingReservation={
        roomStatus[roomForReservation?.key] === "busy"
          ? JSON.parse(localStorage.getItem("reservations") || "{}")[user?.email]
          : null
      }

      onConfirm={({ start, end, purpose }) => {
        const { key, id, roomName } = roomForReservation;
        // >>> BACKEND: TU wysyłasz nową rezerwację (POST /api/reservations)
        // fetch(SERVER_ENDPOINT + '/api/reservations', {...})
        setRoomStatus(prev => ({
          ...prev,
          [key]: "busy",
        }));

        const allReservations = JSON.parse(localStorage.getItem("reservations") || "{}");

        allReservations[user.email] = {
          floor_id: activeFloorId,
          room_id: id,
          room_name: roomName,
          user: user?.email,
          user_name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Użytkownik",
          start,
          end,
          purpose,
          timestamp: new Date().toISOString()
        };

        localStorage.setItem("reservations", JSON.stringify(allReservations));

        window.dispatchEvent(new Event("room-reservations-updated"));
        setModalOpen(false);
      }}

      onDelete={() => {
        const { key } = roomForReservation;
        // >>> BACKEND: TU usuwasz rezerwację (DELETE /api/reservations/{reservation_id}`)
        setRoomStatus(prev => ({
          ...prev,
          [key]: "free",
        }));

        const reservations = JSON.parse(localStorage.getItem("reservations") || "{}");
        delete reservations[user.email];
        localStorage.setItem("reservations", JSON.stringify(reservations));

        window.dispatchEvent(new Event("room-reservations-updated"));
        setModalOpen(false);
      }}
    />

  </div>
  {/* Bottom action buttons (import/delete) */}
  {isAdmin && (
  <div className="flex gap-3 mt-4">
    {svgMarkup && (
      <button
        onClick={handleResetPlan}
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition"
      >
        Usuń plan
      </button>
    )}

    <label className="cursor-pointer bg-gray-700 text-white px-4 py-2 rounded text-sm hover:bg-gray-800 transition">
      Importuj plany pięter
      <input
        type="file"
        accept=".svg"
        multiple
        className="hidden"
        onChange={handleUploadMany}
      />
    </label>
  </div>
)}
  </div>
);

}

// FloorList Component — displays all saved floor plans
function FloorList({ setSvgMarkup, setActiveFloorId }) {
  const [plans, setPlans] = useState([]);
  const activeId = localStorage.getItem("active_floor_id");

  const stripExt = (name) => name.replace(/\.svg$/i, "");

  const refreshPlans = () => {
    const saved = JSON.parse(localStorage.getItem("floor_plans") || "[]");
    setPlans(saved);
  };

  useEffect(() => {
    refreshPlans();

    const handleStorageChange = () => refreshPlans();
    window.addEventListener("storage", handleStorageChange);

    window.addEventListener("floorplans-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("floorplans-updated", handleStorageChange);
    };
  }, []);

  const handleSelect = (plan) => {
    localStorage.setItem("active_floor_id", plan.id);
    setActiveFloorId(plan.id);
    setSvgMarkup(plan.svg);
    window.dispatchEvent(new Event("floorplans-updated"));
  };

  if (!plans.length) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <h3 className="font-semibold text-sm mb-2">Dostępne plany:</h3>
      {/* Scrollable list of plans */}
      <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
        {plans.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p)}
            className={`text-left px-3 py-1 rounded text-sm transition truncate ${
              p.id === activeId
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
            title={stripExt(p.name)}
          >
            {stripExt(p.name)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReservationModal({
  isOpen,
  onClose,
  onConfirm,
  onDelete,
  roomName,
  user,
  isBusy,
  existingReservation
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [purpose, setPurpose] = useState("");

  useEffect(() => {
    if (!isOpen || isBusy) return;

    const now = new Date("2025-08-10T22:30:00");
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1500); // default reservation for 1.5h

    function formatLocalDateTime(date) {
      const pad = (n) => String(n).padStart(2, "0");

      return (
        date.getFullYear() +
        "-" +
        pad(date.getMonth() + 1) +
        "-" +
        pad(date.getDate()) +
        "T" +
        pad(date.getHours()) +
        ":" +
        pad(date.getMinutes())
      );
    }
    
    const format = formatLocalDateTime;

    setStart(format(now));
    setEnd(format(inOneHour));
    setPurpose("");
  }, [isOpen, isBusy]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[350px]">

        <h2 className="text-xl font-semibold mb-4">
          {isBusy ? "Szczegóły rezerwacji" : "Rezerwacja pokoju"}
        </h2>

        {/* użytkownik */}
        <div className="mb-2">
          <label className="text-sm text-gray-600">Użytkownik</label>
          <input
            type="text"
            value={`${user?.first_name || ""} ${user?.last_name || ""}`.trim()}
            disabled
            className="w-full border rounded px-3 py-2 bg-gray-100"
          />
        </div>

        {/* pokój */}
        <div className="mb-2">
          <label className="text-sm text-gray-600">Pokój</label>
          <input
            type="text"
            value={roomName}
            disabled
            className="w-full border rounded px-3 py-2 bg-gray-100"
          />
        </div>

        {/* widoczne gdy pokój zajęty */}
        {isBusy && existingReservation && (
          <>
            <div className="mb-2">
              <label className="text-sm text-gray-600">Rezerwacja od</label>
              <input
                type="text"
                disabled
                value={existingReservation.start}
                className="w-full border rounded px-3 py-2 bg-gray-100"
              />
            </div>

            <div className="mb-2">
              <label className="text-sm text-gray-600">Rezerwacja do</label>
              <input
                type="text"
                disabled
                value={existingReservation.end}
                className="w-full border rounded px-3 py-2 bg-gray-100"
              />
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-600">Cel rezerwacji</label>
              <input
                type="text"
                disabled
                value={existingReservation.purpose}
                className="w-full border rounded px-3 py-2 bg-gray-100"
              />
            </div>
          </>
        )}

        {/* widoczne gdy pokój wolny */}
        {!isBusy && (
          <>
            <div className="mb-2">
              <label className="text-sm text-gray-600">Data rozpoczęcia</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>

            <div className="mb-2">
              <label className="text-sm text-gray-600">Data zakończenia</label>
              <input
                type="datetime-local"
                className="w-full border rounded px-3 py-2"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-600">Cel rezerwacji</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </>
        )}

        {/* przyciski */}
        <div className="flex justify-end gap-2 mt-4">

          {isBusy && (
            <button
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              onClick={onDelete}
              // >>> BACKEND: TU usuwasz rezerwację (DELETE /api/reservations/{reservation_id}`)
            >
              Usuń rezerwację
            </button>
          )}

          <button
            className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
            onClick={onClose}
          >
            Zamknij
          </button>

          {!isBusy && (
            <button
              disabled={!start || !end || end < start}
              className={`px-4 py-2 rounded text-white transition ${
                !start || !end || end < start
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              onClick={() => onConfirm({ start, end, purpose })}
            >
              Potwierdź
            </button>
          )}

        </div>

      </div>
    </div>
  );
}