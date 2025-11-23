import { useState, useEffect } from 'react';
import axios from 'axios';
import { getConfig } from "../../src/config";

const { SERVER_ENDPOINT } = getConfig()

export default function QRCodes() {
  const [formData, setFormData] = useState({
    recipient_info: '',
    valid_from: '',
    valid_until: '',
    usage_limit: 1,
  });
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [rooms, setRooms] = useState([]);
  const [selectedRooms, setSelectedRooms] = useState([]);

  const fetchRooms = async () => {
    try {
      const response = await fetch(SERVER_ENDPOINT + '/api/v1/rooms/list');
      if (!response.ok) throw new Error('Nie udało się pobrać listy pokoi');
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (err) {
      setMessage(err.message);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddRoom = (e) => {
    const roomId = e.target.value;
    if (!roomId) return;
    const room = rooms.find(r => r.room_id === roomId);
    if (room && !selectedRooms.some(r => r.room_id === roomId)) {
      setSelectedRooms([...selectedRooms, room]);
    }
    e.target.value = '';
  };

  const handleRemoveRoom = (roomId) => {
    setSelectedRooms(selectedRooms.filter(r => r.room_id !== roomId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setQrCode(null);

    const issued_by = JSON.parse(localStorage.getItem('user'))?.user_id;

    try {
      const response = await axios.post(SERVER_ENDPOINT + '/qrcode_generation', {
        ...formData,
        issued_by,
        metadata: { rooms: selectedRooms.map(r => r.room_id) },
      });
      setQrCode(response.data.qrCode);
      setMessage('Kod QR wygenerowany pomyślnie!');
    } catch (err) {
      setMessage(`Błąd: ${err.response?.data?.error || 'Nie udało się wygenerować kodu QR'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-4xl font-semibold mb-6">Tworzenie kodów QR</h2>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes('Błąd') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Odbiorca (adres-email)</label>
          <input
            type="text"
            name="recipient_info"
            value={formData.recipient_info}
            onChange={handleChange}
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            placeholder="user@example.com"
          />
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Ważny od</label>
            <input
              type="datetime-local"
              name="valid_from"
              value={formData.valid_from}
              onChange={handleChange}
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Ważny do *</label>
            <input
              type="datetime-local"
              name="valid_until"
              value={formData.valid_until}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-gray-700">Limit użyć</label>
            <input
              type="number"
              name="usage_limit"
              value={formData.usage_limit}
              onChange={handleChange}
              min="1"
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
           {/* Wybór pokoi */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Wybierz pokoje</label>
            <select
              onChange={handleAddRoom}
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="" disabled>Wybierz pokój</option>
              {rooms.map((r) => (
                <option key={r.room_id} value={r.room_id}>{r.name}</option>
              ))}
            </select>

            {/* Lista wybranych pokoi */}
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
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generowanie...' : 'Generuj kod QR'}
        </button>
      </form>
      {qrCode && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Wygenerowany kod QR</h3>
          <img src={qrCode} alt="QR Code" className="w-full border border-gray-300 mx-auto" />
          <p className="text-sm text-gray-600 mt-2">Zeskanuj ten kod, aby wejść. Został wysłany wiadomością e-mail do odbiorcy.</p>
        </div>
      )}
    </div>
  );
}