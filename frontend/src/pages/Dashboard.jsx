import FloorPlan from "../components/FloorPlan";
import { useState, useEffect } from "react";
import { useAuth } from "../components/AuthContext";
import { getConfig } from "../../src/config";

const { SERVER_ENDPOINT } = getConfig()

export default function Dashboard() {
  const [svgMarkup, setSvgMarkup] = useState(null);
  const { user } = useAuth();
  const isAdmin = user?.user_type === "admin";
  const [logs, setLogs] = useState([]);
  const [usersMap, setUsersMap] = useState({});

  const [plans, setPlans] = useState([]);
  const [activeId, setActiveId] = useState(localStorage.getItem("active_floor_id"));
  
  const [svgIds, setSvgIds] = useState([]);
  const [roomStatus, setRoomStatus] = useState({});

  const [roomNames, setRoomNames] = useState({});
  const [pathToRoomId, setPathToRoomId] = useState({});
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    if (!activeId) return;

    const fetchRooms = async () => {
      try {
        const response = await fetch(SERVER_ENDPOINT + '/api/v1/rooms/list');
        if (response.ok) {
          const data = await response.json();
          const roomsForFloor = data.rooms.filter(r => r.svg_id === activeId);

          const names = {};
          const pathToId = {};

          roomsForFloor.forEach(r => {
            if (r.metadata?.path_id) {
              names[`${activeId}:${r.metadata.path_id}`] = r.name;
              pathToId[r.metadata.path_id] = r.room_id;
            }
          });

          setRoomNames(names);
          setPathToRoomId(pathToId);
        }
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };

    fetchRooms();
  }, [activeId]);

  useEffect(() => {
    if (!activeId || Object.keys(pathToRoomId).length === 0) return;

    fetch(SERVER_ENDPOINT + '/api/v1/reservations/list')
      .then(response => response.json())
      .then(data => {
        const allReservations = data.reservations || [];
        setReservations(allReservations);

        const floorRoomIds = Object.values(pathToRoomId);

        const floorReservations = allReservations.filter(r =>
          floorRoomIds.includes(r.room_id) && r.status === "confirmed"
        );

        const status = {};

        Object.keys(pathToRoomId).forEach(pathId => {
          const key = `${activeId}:${pathId}`;
          if (roomNames[key]) status[key] = "free";
        });

        floorReservations.forEach(r => {
          const pathId = Object.keys(pathToRoomId).find(
            pid => pathToRoomId[pid] === r.room_id
          );
          if (pathId) {
            const key = `${activeId}:${pathId}`;
            status[key] = "busy";
          }
        });

        setRoomStatus(status);
      })
      .catch(error => console.error('Error fetching reservations:', error));
  }, [activeId, pathToRoomId, roomNames]);

  useEffect(() => {
    // Fetch latest logs and users for friendly display
    const fetchLogs = async () => {
      try {
        const [logsRes, usersRes] = await Promise.all([
          fetch(SERVER_ENDPOINT + '/api/v1/admin_audit/list'),
          fetch(SERVER_ENDPOINT + '/api/v1/users/list')
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

   useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch(SERVER_ENDPOINT + '/api/v1/svg_files/list');
        if (response.ok) {
          const data = await response.json();
          const fetchedPlans = data.svg_files.map(f => ({ id: f.svg_id.toString(), name: f.filename, svg: f.content }));
          setPlans(fetchedPlans);
          const savedActive = localStorage.getItem("active_floor_id");
          const fallback = fetchedPlans[0]?.id || null;
          const idToUse = savedActive || fallback;
          setActiveId(idToUse);
          setSvgMarkup(fetchedPlans.find(p => p.id === idToUse)?.svg || null);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      }
    };

    const handleStorageChange = () => {
      fetchPlans();
    };

    fetchPlans();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("floorplans-updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("floorplans-updated", handleStorageChange);
    };
  }, []);

  const handleFloorChange = (id) => {
    setActiveId(id);
    localStorage.setItem("active_floor_id", id);
    const plan = plans.find((p) => p.id === id);
    setSvgMarkup(plan?.svg || null);
  };

  return (
    <div className="flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Dashboard</h2>

        {plans.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Piętro:</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={activeId || ""}
              onChange={(e) => handleFloorChange(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.replace(/\.svg$/i, "")}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>


      {/* Floor plan preview */}
      <div
        className="bg-white p-2 rounded-lg shadow mb-4 overflow-hidden select-none flex justify-center items-center mx-auto relative"
        style={{
          width: "100%",
          maxWidth: "800px",
          height: "55vh",
          minHeight: "350px",
        }}
      >
        {plans.length === 0 ? (
          <p className="text-gray-500">Brak map, dodaj mapę w widoku rezerwacji.</p>
        ) : !activeId || !svgMarkup ? (
          <p className="text-gray-500">Ładowanie mapy...</p>
        ) : (
          <div className="w-full h-full flex justify-center items-center svg-wrapper">
            <FloorPlan
              svgMarkup={svgMarkup}
              onIdsDetected={setSvgIds}
              roomStatus={roomStatus}
              activeFloorId={activeId}
            />
          </div>
        )}
      </div>

      {/* Latest Logs Section - For Admins Only */}
      {isAdmin && (
        <div className="bg-white p-2 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-2">Ostatnie logi</h3>

          <ul className="list-disc list-inside space-y-2">
            {logs.length > 0 ? (
              logs.slice(0, 4).map(log => (
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
