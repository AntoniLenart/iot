import FloorPlan from "../components/FloorPlan";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [hrFree, setHrFree] = useState(true);
  const [mainFree, setMainFree] = useState(true);
  const [svgMarkup, setSvgMarkup] = useState(null);

  useEffect(() => {
  const saved = localStorage.getItem("floor_plan_svg");
  if (saved) setSvgMarkup(saved);

  const savedRooms = localStorage.getItem("rooms_state");
  if (savedRooms) {
    const { hrFree, mainFree } = JSON.parse(savedRooms);
    setHrFree(hrFree);
    setMainFree(mainFree);
  }
}, []);

  useEffect(() => {
  localStorage.setItem("rooms_state", JSON.stringify({
    hrFree,
    mainFree,
  }));
}, [hrFree, mainFree]);

  const handleUpload = async (e) => {
  const file = e.target.files[0];

  if (!file) return;
  
  const text = await file.text();
  setSvgMarkup(text);
  localStorage.setItem("floor_plan_svg", text);
  };

  const handleResetPlan = () => {
  setSvgMarkup(null);
  setHrFree(true);
  setMainFree(true);
  localStorage.removeItem("floor_plan_svg");
  localStorage.removeItem("rooms_state");
};


  return (
    <div className="p-1 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Dashboard</h2>

    {svgMarkup && (
      <div className="flex gap-3">
        {/* HR */}
        <button
          onClick={() => setHrFree(prev => !prev)}
          className={`px-3 py-1 text-sm rounded font-medium transition ${
            hrFree
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          {hrFree ? "Zarezerwuj pokój HR" : "Usuń rezerwację HR"}
        </button>

        {/* Main */}
        <button
          onClick={() => setMainFree(prev => !prev)}
          className={`px-3 py-1 text-sm rounded font-medium transition ${
            mainFree
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          {mainFree ? "Zarezerwuj pokój Main" : "Usuń rezerwację Main"}
        </button>
      </div>
    )}
      </div>

      {/* Mapa sal */}
      <div className="bg-white p-1 rounded-lg shadow min-h-[400px] flex justify-center items-center">
        {svgMarkup ? (
          <FloorPlan hrFree={hrFree} mainFree={mainFree} svgMarkup={svgMarkup} />
        ) : (
          <p className="text-gray-500">Brak wczytanego planu piętra</p>
        )}
      </div>

        <div className="flex justify-end items-center gap-3 my-1">
          {/* Reset planu */}
          {svgMarkup && (
            <button
              onClick={handleResetPlan}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded text-sm transition"
            >
              Usuń plan
            </button>
          )}

          {/* Import planu */}
          <label className="cursor-pointer bg-gray-700 text-white px-4 py-1 rounded text-sm hover:bg-gray-800 transition">
            Importuj plan piętra
            <input type="file" accept=".svg" className="hidden" onChange={handleUpload} />
          </label>
        </div>

      {/* Sekcja ostatnich logów */}
      <div className="bg-white p-2 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-2">Ostatnie logi</h3>
        <ul className="list-disc list-inside space-y-2">
          <li>Użytkownik Jan Kowalski zalogował się o 09:15</li>
          <li>Admin utworzył nowego użytkownika: Anna Nowak</li>
          <li>Rezerwacja sali 101 została zatwierdzona na 14:00</li>
        </ul>
      </div>
    </div>
  );
}