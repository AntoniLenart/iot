import FloorPlan from "../components/FloorPlan";
import { useState, useEffect } from "react";
import { useAuth } from "../components/AuthContext";

export default function Rooms() {
  const { user } = useAuth();
  const isAdmin = user?.user_type === "admin";

  const [svgMarkup, setSvgMarkup] = useState(null);
  const [svgIds, setSvgIds] = useState([]);
  const [hoveredRoomId, setHoveredRoomId] = useState(null);
  const [roomNames, setRoomNames] = useState({});
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [roomStatus, setRoomStatus] = useState({});
  const activeFloorId = localStorage.getItem("active_floor_id");

  useEffect(() => {
  // wczytaj wszystkie zapisane plany
  const savedPlans = JSON.parse(localStorage.getItem("floor_plans") || "[]");
  const activeId = localStorage.getItem("active_floor_id");

  if (savedPlans.length > 0) {
    // znajdź aktywny plan
    const activePlan =
      savedPlans.find((p) => p.id === activeId) || savedPlans[0];
    if (activePlan) setSvgMarkup(activePlan.svg);
  }
}, []);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("room_names") || "{}");
    setRoomNames(saved);
  }, []);

  // Zapisuj nazwy pokojów, gdy się zmienią
  useEffect(() => {
    localStorage.setItem("room_names", JSON.stringify(roomNames));
  }, [roomNames]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("room_reservations") || "{}");
    setRoomStatus(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("room_reservations", JSON.stringify(roomStatus));
  }, [roomStatus]);

  const handleUploadMany = async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  // wczytaj istniejące plany
  const existing = JSON.parse(localStorage.getItem("floor_plans") || "[]");

  // wczytaj wszystkie pliki równolegle
  const loaded = await Promise.all(
    files.map(async (file) => {
      const svg = await file.text();
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        svg,
      };
    })
  );

  const merged = [...existing, ...loaded];
  localStorage.setItem("floor_plans", JSON.stringify(merged));

  localStorage.setItem("active_floor_id", merged[merged.length - loaded.length].id);

  setSvgMarkup(loaded[0].svg);
  window.dispatchEvent(new Event("floorplans-updated"));
};

  const handleResetPlan = () => {
  const activeId = localStorage.getItem("active_floor_id");
  const savedPlans = JSON.parse(localStorage.getItem("floor_plans") || "[]");
  const updatedPlans = savedPlans.filter((p) => p.id !== activeId);

  localStorage.setItem("floor_plans", JSON.stringify(updatedPlans));

  if (updatedPlans.length > 0) {
    const next = updatedPlans[0];
    setSvgMarkup(next.svg);
    localStorage.setItem("active_floor_id", next.id);
  } else {
    setSvgMarkup(null);
    localStorage.removeItem("active_floor_id");
  }

  // nowy event, działa natychmiast w tym samym oknie
  window.dispatchEvent(new Event("floorplans-updated"));
};

  return (
  <div className="p-4 flex flex-col gap-6 items-start">
    <div className="flex flex-row justify-center gap-6 items-start w-full">
    {/* Mapa sal */}
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
    svgMarkup={svgMarkup}
    onIdsDetected={setSvgIds}
    hoveredRoomId={hoveredRoomId}
    roomStatus={roomStatus}
/>
    </div>
  ) : (
    <p className="text-gray-500">Brak wczytanego planu piętra</p>
  )}
</div>

    {/* PRAWA STRONA — PRZYCISKI + LISTA PLANÓW */}
    <div className="w-[400px] flex flex-col justify-between h-[65vh]">

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2">
      {svgIds.map(id => (
        roomNames[id] && (
      <button
        key={id}
        onClick={() =>
          setRoomStatus(prev => ({
            ...prev,
            [`${activeFloorId}:${id}`]: !prev[`${activeFloorId}:${id}`]
          }))
        }
        className={`px-3 py-2 text-sm rounded font-medium transition ${
          roomStatus[`${activeFloorId}:${id}`]
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-red-600 hover:bg-red-700 text-white"
        }`}
      >
        {roomStatus[`${activeFloorId}:${id}`]
          ? `Zarezerwuj pokój ${roomNames[id] || id}`   // TRUE → pokój wolny → można usunąć rezerwację
          : `Usuń rezerwację ${roomNames[id] || id}`}
      </button>
        )
    ))}
    </div>

      {/* LISTA PLANÓW DO WYBORU */}
    <div className="pt-3">
      <FloorList setSvgMarkup={setSvgMarkup} />
    </div>
  </div>

  {/*Lista znalezionych pokojow w danym pietrze */}
  {isAdmin && svgMarkup && (
  <div className="w-1/2 mt-10 p-5 bg-white rounded shadow border text-sm">

    {/* ŁADNY, ELEGANCKI NAGŁÓWEK */}
    <h2 className="text-2xl font-bold mb-4 text-gray-900">
      Sekcja dla administratora
    </h2>

    <h3 className="text-lg font-semibold mb-3 text-gray-800">
      Przydział pomieszczeń
    </h3>
  {svgIds.length > 0 ? (
    <div className="flex flex-col gap-3">
      {svgIds.map((id, index) => (
        <div
          key={id}
          className="p-3 bg-white rounded border flex flex-col gap-1"
          onMouseEnter={() => setHoveredRoomId(id)}
          onMouseLeave={() => setHoveredRoomId(null)}
          onClick={() => {
            setEditingRoomId(id);
            setEditingName(roomNames[id] || "");
          }}
        >
          <span className="font-medium">
            Pomieszczenie {index + 1} — ID:{" "}
            <span className="text-blue-600">{id}</span>
          </span>

          {roomNames[id] && (
            <span className="text-sm text-green-700">
              Nazwa: <b>{roomNames[id]}</b>
            </span>
          )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 italic">
          Nie wykryto żadnych pomieszczeń w tym planie.
        </p>
      )}
    </div>
  )}

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
                setRoomNames(prev => ({
                  ...prev,
                  [editingRoomId]: editingName
                }));

                setRoomStatus(prev => ({
                  ...prev,
                  [`${activeFloorId}:${editingRoomId}`]: true
                }));

                setEditingRoomId(null);
              }}
            >
              Zapisz
            </button>
          </div>
        </div>
      </div>
    )}


  </div>
    {/* DÓŁ STRONY — PRZYCISKI POD CAŁOŚCIĄ */}
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

  </div>
);

}

function FloorList({ setSvgMarkup }) {
  const [plans, setPlans] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem("active_floor_id"));

  // Funkcja pomocnicza do wczytania aktualnej listy
  const refreshPlans = () => {
    const saved = JSON.parse(localStorage.getItem("floor_plans") || "[]");
    setPlans(saved);
    const currentId = localStorage.getItem("active_floor_id");
    setActiveId(currentId);
  };

  useEffect(() => {
    refreshPlans();

    // reaguj na zmiany w localStorage (np. po usunięciu planu)
    const handleStorageChange = () => refreshPlans();
    window.addEventListener("storage", handleStorageChange);

    // dodatkowy event wewnętrzny do odświeżenia w tym samym oknie
    window.addEventListener("floorplans-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("floorplans-updated", handleStorageChange);
    };
  }, []);

  const handleSelect = (plan) => {
    setActiveId(plan.id);
    setSvgMarkup(plan.svg);
    localStorage.setItem("active_floor_id", plan.id);
  };

  if (!plans.length) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <h3 className="font-semibold text-sm mb-2">Dostępne plany:</h3>
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
            title={p.name}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}