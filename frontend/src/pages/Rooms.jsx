import FloorPlan from "../components/FloorPlan";
import { useState, useEffect, useRef } from "react";
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
  const [roomStatus, setRoomStatus] = useState({});
  const [activeFloorId, setActiveFloorId] = useState(() =>
    localStorage.getItem("active_floor_id")
  );

  const [activeFloorName, setActiveFloorName] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [roomForReservation, setRoomForReservation] = useState(null);

  const [svgMarkup, setSvgMarkup] = useState(() => {
    const savedPlans = JSON.parse(localStorage.getItem("floor_plans") || "[]");
    const activeId = localStorage.getItem("active_floor_id");
    const activePlan = savedPlans.find((p) => p.id === activeId) || savedPlans[0];
    return activePlan ? activePlan.svg : null;
  });

  const [description, setDescription] = useState("");
  const [currentDescription, setCurrentDescription] = useState("");

  const fileInputRef = useRef(null);

  // Load floor plans on mount
  useEffect(() => {
    const fetchFloorPlans = async () => {
      try {
        const response = await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/list');
        if (response.ok) {
          const data = await response.json();
          const plans = data.svg_files.map(f => ({ id: f.svg_id.toString(), name: f.filename, svg: f.content }));
          const activeId = localStorage.getItem("active_floor_id");
          const activePlan = plans.find((p) => p.id === activeId) || plans[0];
          if (activePlan) {
            setSvgMarkup(activePlan.svg);
            setActiveFloorId(activePlan.id);
            setActiveFloorName(activePlan.name);
          }
        }
      } catch (error) {
        console.error('Error fetching floor plans:', error);
      }
    };
    fetchFloorPlans();
  }, []);

  useEffect(() => {
    // No localStorage for roomNames, handled by backend
  }, [roomNames]);

  useEffect(() => {
    // No localStorage for roomStatus, handled by backend
  }, [roomStatus]);

  const [pathToRoomId, setPathToRoomId] = useState({});
  const [reservations, setReservations] = useState([]);
  const userHasReservation = reservations.some(
    r => r.user_id === user?.user_id && r.status === "confirmed"
  );

  // Load rooms for active floor
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch(SERVER_ENDPOINT + '/api/v1/rooms/list');
        if (response.ok) {
          const data = await response.json();
          const roomsForFloor = data.rooms.filter(r => r.svg_id === activeFloorId);
          const names = {};
          const pathToRoomId = {};
          roomsForFloor.forEach(r => {
            if (r.metadata && r.metadata.path_id) {
              names[`${activeFloorId}:${r.metadata.path_id}`] = r.name;
              pathToRoomId[r.metadata.path_id] = r.room_id;
            }
          });
          setRoomNames(names);
          setPathToRoomId(pathToRoomId);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };
    if (activeFloorId) fetchRooms();
  }, [activeFloorId]);

  // Fetch reservations and set roomStatus for active floor
  useEffect(() => {
  if (activeFloorId && Object.keys(pathToRoomId).length > 0) {

    fetch(SERVER_ENDPOINT + '/api/v1/reservations/list')
      .then(response => response.json())
      .then(data => {
        const allReservations = data.reservations || [];
        const floorRoomIds = Object.values(pathToRoomId);

        // reservations only for one plan
        const floorReservations = allReservations.filter(
          r => floorRoomIds.includes(r.room_id) && r.status === 'confirmed'
        );

        setReservations(allReservations);

        const status = {};

        // 1) Default all rooms free
        Object.entries(pathToRoomId).forEach(([pathId]) => {
          const key = `${activeFloorId}:${pathId}`;
          if (roomNames[key]) {
            status[key] = "free";
          }
        });


        floorReservations.forEach(r => {
          const pathId = Object.keys(pathToRoomId).find(
            pid => pathToRoomId[pid] === r.room_id
          );
          if (!pathId) return;

          const key = `${activeFloorId}:${pathId}`;

          // 🔥 każda rezerwacja = pokój zajęty (czerwony)
          status[key] = "busy_now";
        });

        setRoomStatus(status);
      })
      .catch(error => console.error('Error fetching reservations:', error));
  }
}, [activeFloorId, pathToRoomId, roomNames]);


  // Handle uploading multiple SVG floor plans
  const handleUploadMany = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      try {
        const svg = await file.text();
        const response = await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, description: description || null, content: svg, added_by: user?.user_id })
        });
        if (response.ok) {
          const data = await response.json();
          const svg_id = data.svg_file?.svg_id?.toString();
          if (!svg_id) {
            console.error('Invalid response: missing svg_id for file', file.name);
            continue; // Skip room creation for this file
          }

          // Parse SVG to extract path IDs
          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, 'image/svg+xml');
          const paths = doc.querySelectorAll('[id]');
          const ids = Array.from(paths).map(p => p.id);

          // Create rooms for each detected path ID
          for (const id of ids) {
            try {
              await fetch(SERVER_ENDPOINT + '/api/v1/rooms/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: '', floor: file.name, svg_id: svg_id, metadata: { path_id: id } })
              });
            } catch (roomError) {
              console.error('Error creating room for path ID', id, roomError);
            }
          }
        } else {
          console.error('Failed to upload file', file.name, 'Response status:', response.status);
        }
      } catch (error) {
        console.error('Error uploading floor plan or creating rooms:', error);
      }
    }

    // Reset description after upload
    setDescription("");

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Refresh plans
    const response = await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/list');
    if (response.ok) {
      const data = await response.json();
      const plans = data.svg_files.map(f => ({ id: f.svg_id.toString(), name: f.filename, svg: f.content }));
      const newActive = plans[plans.length - 1]?.id;
      if (newActive) {
        localStorage.setItem("active_floor_id", newActive);
        setSvgMarkup(plans.find(p => p.id === newActive)?.svg);
        setActiveFloorId(newActive);
      }
    }

    window.dispatchEvent(new Event("floorplans-updated"));
  };

  // Remove currently active plan
  const handleResetPlan = async () => {
    const activeId = localStorage.getItem("active_floor_id");
    if (activeId) {
      try {
        await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ svg_id: activeId })
        });
      } catch (error) {
        console.error('Error deleting floor plan:', error);
        return; // Stop if delete fails
      }
    }

    // Clear all data to refresh for new floor
    setRoomNames({});
    setRoomStatus({});
    setReservations([]);
    setSvgIds([]);
    setPathToRoomId({});

    // Fetch updated plans
    try {
      const response = await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/list');
      if (response.ok) {
        const data = await response.json();
        const plans = data.svg_files.map(f => ({ id: f.svg_id.toString(), name: f.filename, svg: f.content }));
        if (plans.length > 0) {
          const next = plans[0];
          setSvgMarkup(next.svg);
          localStorage.setItem("active_floor_id", next.id);
          setActiveFloorId(next.id);
        } else {
          setSvgMarkup(null);
          localStorage.removeItem("active_floor_id");
          setActiveFloorId(null);
        }
      }
    } catch (error) {
      console.error('Error fetching updated plans:', error);
    }

    window.dispatchEvent(new Event("floorplans-updated"));
  };

  // Load current description when activeFloorId changes
  useEffect(() => {
    if (activeFloorId) {
      const fetchDescription = async () => {
        try {
          const response = await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/get?svg_id=' + activeFloorId);
          if (response.ok) {
            const data = await response.json();
            setCurrentDescription(data.svg_file.description || "");
          }
        } catch (error) {
          console.error('Error fetching description:', error);
        }
      };
      fetchDescription();
    }
  }, [activeFloorId]);

  // Handle saving description
  const handleSaveDescription = async () => {
    if (!activeFloorId) return;
    try {
      await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svg_id: activeFloorId, description: currentDescription })
      });
      alert("Opis został zapisany.");
    } catch (error) {
      console.error('Error saving description:', error);
      alert("Błąd podczas zapisywania opisu.");
    }
  };

  return (
  <div className="p-4 flex flex-col gap-4 items-start">
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
      {user && svgIds.map(id => {
  const key = `${activeFloorId}:${id}`;

  // 1) Rezerwacja użytkownika (jeśli ma)
  const userRoomReservation = reservations.find(
    r =>
      r.room_id === pathToRoomId[id] &&
      r.status === "confirmed" &&
      r.user_id === user.user_id
  );

  // 2) Rezerwacja tego pokoju — jakakolwiek
  const roomReservations = reservations
  .filter(r => r.room_id === pathToRoomId[id] && r.status === "confirmed")
  .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

  // 3) Czy user jest właścicielem tej rezerwacji?
  const now = Date.now();

const currentReservation = roomReservations.find(r =>
  new Date(r.start_at) <= now && new Date(r.end_at) >= now
);

const nextReservation = roomReservations.find(r =>
  new Date(r.start_at) > now
);

const isUserReservation = !!roomReservations.find(
  r => r.user_id === user.user_id
);

const isBusyNow = !!currentReservation;
const isFutureReservation = !!nextReservation;


const disabled =
  !isUserReservation && (isBusyNow || userHasReservation);

let btnText = "";
if (isUserReservation) btnText = `Usuń rezerwację ${roomNames[key]}`;
else if (isBusyNow) btnText = "Pokój zajęty";
else if (isFutureReservation) btnText = " Rezerwacja";
else btnText = `Zarezerwuj ${roomNames[key]}`;

  return roomNames[key] && (
    <button
      key={id}
      disabled={disabled}
      onClick={() => {
        const userReservation = reservations.find(
    r => r.user_id === user.user_id && r.status === "confirmed"
  );

  if (userReservation) {
    // pokaż TYLKO modal z jego rezerwacją
    setRoomForReservation({
      id,
      key,
      roomName: roomNames[key],
      reservation: userReservation
    });

    setModalOpen(true);
    return; // ⛔️ blokuje przejście dalej
      }

      // 🔵 normalne działanie jeśli nie ma rezerwacji
      const now = Date.now();

      const current = roomReservations.find(r =>
        new Date(r.start_at) <= now && new Date(r.end_at) >= now
      );

      const next = roomReservations.find(r =>
        new Date(r.start_at) > now
      );

      setRoomForReservation({
        id,
        key,
        roomName: roomNames[key],
        reservation: current || next || null
      });

      setModalOpen(true);
      }}
      className={`px-3 py-2 text-sm rounded font-medium transition
  ${
    isUserReservation
      ? "bg-red-600 hover:bg-red-700"
      : isBusyNow
      ? "bg-red-600 hover:bg-red-700"
      : isFutureReservation
      ? "bg-yellow-500 hover:bg-yellow-600"
      : "bg-green-600 hover:bg-green-700"
  }
  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
`}
    >
      {btnText}
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
              // Update backend
              const roomId = pathToRoomId[editingRoomId];
              if (roomId) {
                fetch(SERVER_ENDPOINT + '/api/v1/rooms/update', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ room_id: roomId, name: editingName, metadata: { path_id: editingRoomId } })
                }).catch(error => console.error('Error updating room:', error));
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
      isBusy={
  (() => {
    if (!roomForReservation?.reservation) return false;
    const now = Date.now();
    const start = new Date(roomForReservation.reservation.start_at).getTime();
    const end = new Date(roomForReservation.reservation.end_at).getTime();
    
    return start <= now && end >= now;
  })()
}

      existingReservation={roomForReservation?.reservation || null}
      userHasReservation={userHasReservation}

      onConfirm={async ({ start, end, purpose }) => {
        const { key, id } = roomForReservation;

        try {
          await fetch(SERVER_ENDPOINT + '/api/v1/reservations/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              room_id: pathToRoomId[id],
              user_id: user.user_id,
              start_at: start,
              end_at: end,
              created_by: user.user_id,
              status: 'confirmed',
              metadata: { purpose }
            })
          });
          


          const startTs = new Date(start.replace(" ", "T") + ":00").getTime();
            const endTs = new Date(end.replace(" ", "T") + ":00").getTime();
            const nowTs = Date.now();
            

            setRoomStatus(prev => ({
              ...prev,
              [key]: startTs <= nowTs && endTs >= nowTs ? "busy_now" : "busy_future"
            }));
          // Refresh reservations
          const response = await fetch(SERVER_ENDPOINT + '/api/v1/reservations/list');
          if (response.ok) {
            const data = await response.json();
            setReservations(data.reservations || []);
          }
        } catch (error) {
          console.error('Error creating reservation:', error);
        }
        setModalOpen(false);
      }}

      onDelete={async () => {
        const { key, reservation } = roomForReservation;
        if (reservation?.reservation_id) {
          try {
            await fetch(SERVER_ENDPOINT + '/api/v1/reservations/remove', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reservation_id: reservation.reservation_id })
            });
            setRoomStatus(prev => ({
              ...prev,
              [key]: "free",
            }));
            // Refresh reservations
            const response = await fetch(SERVER_ENDPOINT + '/api/v1/reservations/list');
            if (response.ok) {
              const data = await response.json();
              setReservations(data.reservations || []);
            }
          } catch (error) {
            console.error('Error deleting reservation:', error);
          }
        }
        window.dispatchEvent(new Event("room-reservations-updated"));
        setModalOpen(false);
      }}
    />

  </div>
  {/* Bottom action buttons (import/delete) */}
  {isAdmin && (
  <div className="flex gap-3 mt-3">
    {svgMarkup && (
      <button
        onClick={handleResetPlan}
        className="cursor-pointer bg-gray-700 text-white px-4 py-2 rounded text-sm hover:bg-gray-800 transition"
      >
        Usuń plan
      </button>
    )}

    <div className="flex flex-col gap-2">
      <label className="cursor-pointer bg-gray-700 text-white px-4 py-2 rounded text-sm hover:bg-gray-800 transition">
        Importuj plany pięter
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg"
          multiple
          className="hidden"
          onChange={handleUploadMany}
        />
      </label>
    </div>
  </div>
)}
  {isAdmin && activeFloorId && (
    <div className="flex gap-3 w-full md:w-auto">
      <input
        type="text"
        placeholder="Opis aktualnego planu"
        value={currentDescription}
        onChange={(e) => setCurrentDescription(e.target.value)}
        className="border rounded px-3 py-2 text-sm flex-1 md:w-67"
      />
      <button
        onClick={handleSaveDescription}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition"
      >
        Zapisz
      </button>
    </div>
  )}

  {/* Admin section for mobile (appears below buttons) */}
  {isAdmin && svgMarkup && (
    <div className="block md:hidden w-full mt-6 p-5 bg-white rounded shadow border text-sm">
      <h2 className="text-2xl font-bold mb-4 text-gray-900">Sekcja dla administratora</h2>
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Przydział pomieszczeń</h3>

      {[...svgIds].length > 0 ? (
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

  </div>
);

}

// FloorList Component — displays all saved floor plans
function FloorList({ setSvgMarkup, setActiveFloorId }) {
  const [plans, setPlans] = useState([]);
  const activeId = localStorage.getItem("active_floor_id");

  const stripExt = (name) => name.replace(/\.svg$/i, "");

  const refreshPlans = async () => {
    try {
      const response = await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/list');
      if (response.ok) {
        const data = await response.json();
        const fetchedPlans = data.svg_files.map(f => ({ id: f.svg_id.toString(), name: f.filename, svg: f.content }));
        setPlans(fetchedPlans);
      }
    } catch (error) {
      console.error('Error refreshing plans:', error);
    }
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
  existingReservation,
   userHasReservation
}) {
  const isUserOwnReservation =
    existingReservation && existingReservation.user_id === user.user_id;
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [purpose, setPurpose] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  

  useEffect(() => {
    if (!isOpen || isBusy) return;

    const now = new Date();
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

  useEffect(() => {
    if (!start || !end || !existingReservation) {
      setHasConflict(false);
      return;
    }

    const startTs = new Date(start).getTime();
    const endTs   = new Date(end).getTime();

    const rs = new Date(existingReservation.start_at).getTime();
    const re = new Date(existingReservation.end_at).getTime();

    const overlaps = !(endTs <= rs || startTs >= re);

    setHasConflict(overlaps);
  }, [start, end, existingReservation]);

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

        {/* podgląd przyszłej rezerwacji */}
          {!isBusy && existingReservation && (
            <div className="mb-3 p-2 border rounded bg-yellow-50">
              <p className="text-sm text-gray-700 font-medium mb-1">
                Rezerwacja:
              </p>
              <p className="text-sm text-gray-600">
                Od: <b>{existingReservation.start_at.slice(0, 16)}</b>
              </p>
              <p className="text-sm text-gray-600">
                Do: <b>{existingReservation.end_at.slice(0, 16)}</b>
              </p>
              {existingReservation.metadata?.purpose && (
                <p className="text-sm text-gray-600 mt-1">
                  Cel: <i>{existingReservation.metadata.purpose}</i>
                </p>
              )}
            </div>
          )}

        {/* widoczne gdy pokój zajęty */}
        {isBusy && existingReservation && (
          <>
            <div className="mb-2">
              <label className="text-sm text-gray-600">Rezerwacja od</label>
              <input
                type="text"
                disabled
                value={existingReservation.start_at.slice(0, 16)}
                className="w-full border rounded px-3 py-2 bg-gray-100"
              />
            </div>

            <div className="mb-2">
              <label className="text-sm text-gray-600">Rezerwacja do</label>
              <input
                type="text"
                disabled
                value={existingReservation.end_at.slice(0, 16)}
                className="w-full border rounded px-3 py-2 bg-gray-100"
              />
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-600">Cel rezerwacji</label>
              <input
                type="text"
                disabled
                value={existingReservation.metadata?.purpose || ""}
                className="w-full border rounded px-3 py-2 bg-gray-100"
              />
            </div>
          </>
        )}

        {/* widoczne gdy pokój wolny */}
        {!isUserOwnReservation && !isBusy && (
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
                max={
                  !isBusy && existingReservation
                    ? existingReservation.start_at.slice(0, 16)
                    : undefined
                }
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            {hasConflict && (
            <p className="text-red-600 text-sm mt-1 mb-2">
              Wybrany termin nachodzi na istniejącą rezerwację.
            </p>
          )}

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

          {existingReservation?.user_id === user.user_id && (
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

          {!isUserOwnReservation && !isBusy && !userHasReservation &&(
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