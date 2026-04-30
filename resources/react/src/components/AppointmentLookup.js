import React, { useState } from 'react';
import { appointmentsAPI } from '../services/api';

const AppointmentLookup = () => {
  const [phone, setPhone] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await appointmentsAPI.getByPhone(phone);

      if (response.data.success) {
        setAppointments(response.data.data);
        setSearched(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không tìm thấy lịch hẹn');
      setAppointments([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Chờ xác nhận' },
      'confirmed': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Đã xác nhận' },
      'in-process': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Đang thực hiện' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', label: 'Hoàn thành' },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Đã hủy' },
      'no-show': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Không tới' }
    };
    const current = statusMap[status] || statusMap['pending'];
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${current.bg} ${current.text}`}>
        {current.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Tra Cứu Lịch Hẹn</h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-pink-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Tìm kiếm...' : 'Tìm Kiếm'}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && searched && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Appointments List */}
        {searched && appointments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Tìm Thấy {appointments.length} Lịch Hẹn
            </h2>
            {appointments.map((appointment) => (
              <div key={appointment.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Ngày/Giờ</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(appointment.appointment_date).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Trạng Thái</p>
                    <div className="mt-1">
                      {getStatusBadge(appointment.status)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Thợ</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {appointment.staff?.name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tổng Tiền</p>
                    <p className="text-lg font-semibold text-pink-600">
                      {parseFloat(appointment.total_price).toLocaleString('vi-VN')} ₫
                    </p>
                  </div>
                </div>

                {/* Services */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Dịch Vụ:</p>
                  <div className="flex flex-wrap gap-2">
                    {appointment.services?.map((service) => (
                      <span key={service.id} className="bg-pink-100 text-pink-800 px-3 py-1 rounded-full text-sm">
                        {service.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {appointment.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-semibold text-gray-700">Ghi Chú:</p>
                    <p className="text-gray-600">{appointment.notes}</p>
                  </div>
                )}

                {appointment.status === 'cancelled' && (
                  <div className="mt-4 text-sm text-red-600 font-semibold">
                    Lịch hẹn này đã bị hủy
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {searched && appointments.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 text-lg">Không tìm thấy lịch hẹn nào</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentLookup;
