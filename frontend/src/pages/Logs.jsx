import { useState, useEffect } from "react";

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch logs from the database on component mount
  const fetchLogs = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/v1/admin_audit/list');
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data.admin_audit || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) return <div>Loading logs...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="p-6">
      <h2 className="text-4xl font-semibold mb-6">Logi systemowe</h2>

      {/* Logs table */}
      <div className="rounded-xl shadow-lg border border-gray-300 overflow-hidden">
        <table className="w-full bg-white text-center">
          <thead className="bg-gray-100 text-gray-700 text-sm uppercase">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Użytkownik</th>
              <th className="p-3">Akcja</th>
              <th className="p-3">Typ celu</th>
              <th className="p-3">ID celu</th>
              <th className="p-3">Szczegóły</th>
              <th className="p-3">Czas</th>
              <th className="p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr
                  key={log.audit_id}
                  className="border-b hover:bg-blue-50"
                >
                  <td className="p-3">{log.audit_id}</td>
                  <td className="p-3">{log.admin_user || "System"}</td>
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">{log.target_type || "-"}</td>
                  <td className="p-3">{log.target_id || "-"}</td>
                  <td className="p-3">{JSON.stringify(log.details)}</td>
                  <td className="p-3">{new Date(log.occurred_at).toLocaleString()}</td>
                  <td className="p-3">{log.ip_address || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="p-6 text-gray-500 italic">
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