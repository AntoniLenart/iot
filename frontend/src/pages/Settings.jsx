import { useState, useEffect } from 'react';

export default function Settings() {
  const [formData, setFormData] = useState({
    user_id: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user && user.user_id) {
        setFormData((prev) => ({ ...prev, user_id: user.user_id }));
        try {
          const response = await fetch(`http://localhost:4000/api/v1/users/get?user_id=${user.user_id}`);
          if (response.ok) {
            const data = await response.json();
            const { username, email, phone } = data.user;
            setFormData((prev) => ({
              ...prev,
              username: username || '',
              email: email || '',
              phone: phone || '',
            }));
          } else {
            console.error('Failed to fetch user data:', response.statusText);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    fetchUserData();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (formData.password !== formData.confirmPassword) {
      setMessage('Błąd: Hasła nie pasują do siebie');
      return;
    }
    if (!formData.user_id) {
      setMessage('Brak identyfikatora użytkownika');
      return;
    }

    const updateData = {
      user_id: formData.user_id,
      username: formData.username,
      email: formData.email,
      phone: formData.phone,
    };
    if (formData.password) {
      updateData.password = formData.password;
    }

    try {
      const response = await fetch('http://localhost:4000/api/v1/users/update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('Informacje użytkownika zostały zaktualizowane pomyślnie');
      } else {
        setMessage(`Błąd: ${data.error}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setMessage('Wystąpił błąd podczas aktualizacji');
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-4xl font-semibold mb-6">Ustawienia</h2>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.includes('Błąd') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nazwa użytkownika</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Adres e-mail</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Numer telefonu</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nowe hasło</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Potwierdź hasło</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          Zapisz zmiany
        </button>
      </form>
    </div>
  );
}