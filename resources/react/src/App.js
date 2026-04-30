import React, { useContext, useState } from 'react';
import { AuthContext } from './context/AuthContext';
import CustomerHome from './components/CustomerHome';
import BookingForm from './components/BookingForm';
import AppointmentLookup from './components/AppointmentLookup';
import AdminAppointments from './components/AdminAppointments';
import AdminServices from './components/AdminServices';
import AdminCustomers from './components/AdminCustomers';
import AdminSettings from './components/AdminSettings';

// Login Component
const Login = ({ onLogin }) => {
  const { login, loading, error } = useContext(AuthContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      onLogin();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Nail Salon</h1>

        {localError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {localError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật Khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pink-600 text-white font-semibold py-2 rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-gray-600 text-sm">
            Demo Admin: admin / password
          </p>
        </div>
      </div>
    </div>
  );
};

// Navigation Component
const Navigation = ({ user, onLogout, onNavigate, currentPage }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const navItems = isAdmin ? [
    { id: 'dashboard', label: '📊 Lịch Hẹn' },
    { id: 'services', label: '💅 Dịch Vụ' },
    { id: 'customers', label: '👥 Khách Hàng' },
    { id: 'settings', label: '⚙️ Cài Đặt' }
  ] : [
    { id: 'home', label: '🏠 Trang Chủ' },
    { id: 'booking', label: '📅 Đặt Lịch' },
    { id: 'lookup', label: '🔍 Tra Cứu' }
  ];

  return (
    <nav className={`bg-${isAdmin ? 'blue' : 'pink'}-600 text-white shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💅</span>
            <h1 className="text-xl font-bold">Nail Salon</h1>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPage === item.id
                    ? 'bg-white text-pink-600 font-bold'
                    : 'hover:bg-white hover:bg-opacity-20'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm">{user?.name}</span>
            <button
              onClick={onLogout}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-colors"
            >
              🚪 Đăng Xuất
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  currentPage === item.id
                    ? 'bg-white text-pink-600 font-bold'
                    : 'hover:bg-white hover:bg-opacity-20'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

// Main App Component
function App() {
  const { user, isAuthenticated, logout } = useContext(AuthContext);
  const [currentPage, setCurrentPage] = useState('booking');

  if (!isAuthenticated) {
    return <Login onLogin={() => {
      if (user?.role === 'admin') {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('booking');
      }
    }} />;
  }

  const isAdmin = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    setCurrentPage('booking');
  };

  const renderPage = () => {
    if (isAdmin) {
      switch (currentPage) {
        case 'dashboard':
          return <AdminAppointments />;
        case 'services':
          return <AdminServices />;
        case 'customers':
          return <AdminCustomers />;
        case 'settings':
          return <AdminSettings />;
        default:
          return <AdminAppointments />;
      }
    } else {
      switch (currentPage) {
        case 'home':
          return <CustomerHome />;
        case 'booking':
          return <BookingForm />;
        case 'lookup':
          return <AppointmentLookup />;
        default:
          return <CustomerHome />;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        user={user} 
        onLogout={handleLogout}
        onNavigate={setCurrentPage}
        currentPage={currentPage}
      />
      <main>
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
