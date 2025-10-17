export default function Dashboard() {
  return (
    <div className="p-6 flex flex-col h-[calc(100vh-64px)]">
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>

      {/* Miejsce na mapkę pokoi */}
      <div className="bg-white p-6 rounded-lg shadow flex-1 flex items-center justify-center mb-6">
        <span className="text-gray-500 text-lg">Tutaj będzie widok sal / mapka</span>
      </div>

      {/* Sekcja ostatnich logów */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Ostatnie logi</h3>
        <ul className="list-disc list-inside space-y-2">
          <li>Użytkownik Jan Kowalski zalogował się o 09:15</li>
          <li>Admin utworzył nowego użytkownika: Anna Nowak</li>
          <li>Rezerwacja sali 101 została zatwierdzona na 14:00</li>
        </ul>
      </div>
    </div>
  );
}