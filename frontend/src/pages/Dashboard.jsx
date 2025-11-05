import FloorPlan from "../components/FloorPlan";
import { useState, useEffect } from "react";
import { useAuth } from "../components/AuthContext";

export default function Dashboard() {
  const [hrFree, setHrFree] = useState(true);
  const [mainFree, setMainFree] = useState(true);
  const [svgMarkup, setSvgMarkup] = useState(null);
  const { user } = useAuth();
  const isAdmin = user?.user_type === "admin";
  const [logs, setLogs] = useState([]);
  const [usersMap, setUsersMap] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem("floor_plan_svg");
    if (saved) setSvgMarkup(saved);

    const savedRooms = localStorage.getItem("rooms_state");
    if (savedRooms) {
      const { hrFree, mainFree } = JSON.parse(savedRooms);
      setHrFree(hrFree);
      setMainFree(mainFree);
    }

    // Fetch latest logs and users for friendly display
    const fetchLogs = async () => {
      try {
        const [logsRes, usersRes] = await Promise.all([
          fetch('http://localhost:4000/api/v1/admin_audit/list'),
          fetch('http://localhost:4000/api/v1/users/list')
        ]);
        if (logsRes.ok && usersRes.ok) {
          const logsData = await logsRes.json();
          const usersData = await usersRes.json();
          const usersMap = {};
          usersData.users.forEach(u => {
            usersMap[u.user_id] = u.username || `${u.first_name} ${u.last_name}`;
          });
          setUsersMap(usersMap);
          // Filter to logs not older than 24 hours, sort by newest first, take up to 5
          const now = new Date();
          const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const recentLogs = logsData.admin_audit.filter(log => new Date(log.occurred_at) >= twentyFourHoursAgo);
          const sortedLogs = recentLogs.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at)).slice(0, 5);
          setLogs(sortedLogs);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
    };
    if (isAdmin) fetchLogs();
  }, [isAdmin]);

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

  const getFriendlyLog = (log) => {
    const userName = usersMap[log.admin_user] || 'System';
    const time = new Date(log.occurred_at).toLocaleTimeString('pl-PL');
    switch (log.action) {
      case 'login':
        return `${userName} zalogował(a) się o ${time}`;
      case 'logout':
        return `${userName} wylogował(a) się o ${time}`;
      case 'user_create':
        return `${userName} utworzył(a) nowego użytkownika o ${time}`;
      case 'user_update':
        return `${userName} zaktualizował(a) użytkownika o ${time}`;
      case 'user_remove':
        return `${userName} usunął(ęła) użytkownika o ${time}`;
      case 'login_failed':
        return `Nieudana próba logowania o ${time}`;
      default:
        return `${userName} wykonał akcję: ${log.action} o ${time}`;
    }
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

      {/* Sekcja ostatnich logów - tylko dla administratorów */}
      {isAdmin && (
        <div className="bg-white p-2 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-2">Ostatnie logi</h3>
          <ul className="list-disc list-inside space-y-2">
            {logs.length > 0 ? (
              logs.map(log => (
                <li key={log.audit_id}>{getFriendlyLog(log)}</li>
              ))
            ) : (
              <li>Brak logów</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}