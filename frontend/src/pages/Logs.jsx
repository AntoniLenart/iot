import { useState, useEffect } from "react";
import { getConfig } from "../../src/config";

const { SERVER_ENDPOINT } = getConfig()

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [targetsMap, setTargetsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 10;

  // Fetch logs and related data
  const fetchData = async () => {
    try {
      const [
        logsResponse,
        usersResponse,
        credentialsResponse,
        devicesResponse,
        qrResponse,
        roomsResponse,
        doorsResponse,
        desksResponse,
        userGroupsResponse,
        accessPoliciesResponse
      ] = await Promise.all([
        fetch(SERVER_ENDPOINT + '/api/v1/admin_audit/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/users/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/credentials/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/devices/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/qr/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/rooms/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/doors/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/desks/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/user_groups/list'),
        fetch(SERVER_ENDPOINT + '/api/v1/access_policies/list')
      ]);
      if (!logsResponse.ok || !usersResponse.ok || !credentialsResponse.ok || !devicesResponse.ok || !qrResponse.ok || !roomsResponse.ok || !doorsResponse.ok || !desksResponse.ok || !userGroupsResponse.ok || !accessPoliciesResponse.ok) throw new Error('Failed to fetch data');
      
      const logsData = await logsResponse.json();
      const usersData = await usersResponse.json();
      const credentialsData = await credentialsResponse.json();
      const devicesData = await devicesResponse.json();
      const qrData = await qrResponse.json();
      const roomsData = await roomsResponse.json();
      const doorsData = await doorsResponse.json();
      const desksData = await desksResponse.json();
      const userGroupsData = await userGroupsResponse.json();
      const accessPoliciesData = await accessPoliciesResponse.json();
      
      // Create users map
      const usersMap = {};
      usersData.users.forEach(user => {
        usersMap[user.user_id] = user.username || `${user.first_name} ${user.last_name}`;
      });
      setUsersMap(usersMap);
      
      // Create targets map
      const targetsMap = {};
      usersData.users.forEach(user => {
        targetsMap[`user:${user.user_id}`] = `${user.username || `${user.first_name} ${user.last_name}`}`;
      });
      credentialsData.credentials.forEach(item => {
        targetsMap[`credentials:${item.credential_id}`] = `${item.credential_type} (${item.identifier || 'N/A'})`;
      });
      devicesData.devices.forEach(item => {
        targetsMap[`devices:${item.device_id}`] = `${item.name}`;
      });
      qrData.qr_codes.forEach(item => {
        targetsMap[`qr_codes:${item.qr_id}`] = `${item.recipient_info || 'N/A'}`;
      });
      roomsData.rooms.forEach(item => {
        targetsMap[`rooms:${item.room_id}`] = `${item.name}`;
      });
      doorsData.doors.forEach(item => {
        targetsMap[`doors:${item.door_id}`] = `${item.name}`;
      });
      desksData.desks.forEach(item => {
        targetsMap[`desks:${item.desk_id}`] = `${item.code}`;
      });
      userGroupsData.user_groups.forEach(item => {
        targetsMap[`user_groups:${item.group_id}`] = `${item.name}`;
      });
      accessPoliciesData.access_policies.forEach(item => {
        targetsMap[`access_policies:${item.policy_id}`] = `${item.name}`;
      });
      // Add more as needed for other types
      setTargetsMap(targetsMap);
      
      // Sort logs by occurred_at newest first
      const sortedLogs = logsData.admin_audit.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
      setLogs(sortedLogs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div>Loading logs...</div>;
  if (error) return <div>Error: {error}</div>;

  const totalPages = Math.ceil(logs.length / logsPerPage);
  const startIndex = (currentPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const currentLogs = logs.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="p-6">
      <h2 className="text-4xl font-semibold mb-6">Logi systemowe</h2>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mb-4 flex justify-center flex-wrap">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`mx-1 px-3 py-1 border ${currentPage === page ? 'bg-blue-500 text-white' : 'bg-white text-blue-500'} rounded`}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {/* Logs table */}
      <div className="rounded-xl shadow-lg border border-gray-300 overflow-hidden">
        <table className="w-full bg-white text-center">
          <thead className="bg-gray-100 text-gray-700 text-sm uppercase">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Czas</th>
              <th className="p-3">Użytkownik</th>
              <th className="p-3">Typ celu</th>
              <th className="p-3">Cel</th>
              <th className="p-3">Akcja</th>
              <th className="p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {currentLogs.length > 0 ? (
              currentLogs.map((log) => (
                <tr
                  key={log.audit_id}
                  className="border-b hover:bg-blue-50"
                >
                  <td className="p-3">{log.audit_id}</td>
                  <td className="p-3">{new Date(log.occurred_at).toLocaleString()}</td>
                  <td className="p-3">{usersMap[log.admin_user] || "System"}</td>
                  <td className="p-3">{log.target_type || "-"}</td>
                  <td className="p-3">{targetsMap[`${log.target_type}:${log.target_id}`] || "-"}</td>
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">{log.ip_address || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="p-6 text-gray-500 italic">
                  Brak logów
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}