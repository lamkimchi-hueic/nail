import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminNavbar({ activeTab, setActiveTab }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const tabs = [
    { id: 'home', label: '🏠 Trang chủ' },
    { id: 'services', label: '💬 Dịch vụ' },
    { id: 'appointments', label: '📅 Lịch hẹn' },
    { id: 'settings', label: '⚙️ Cài đặt' },
  ];

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center cursor-pointer" onClick={() => navigate('/admin')}>
              <span className="text-2xl">💅</span>
              <span className="ml-2 font-bold text-xl">Admin Panel</span>
            </div>

            <div className="hidden md:flex space-x-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg transition ${
                    activeTab === tab.id ? 'bg-pink-600' : 'hover:bg-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  );
}
