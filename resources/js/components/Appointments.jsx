import React, { useState, useEffect } from 'react';

export default function Appointments({ token, userId }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/my-appointments', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAppointments(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <div>
      {appointments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Bạn chưa có lịch hẹn nào
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{appointment.name}</h3>
                  <p className="text-gray-600 text-sm">📱 {appointment.phone}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                  appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {appointment.status === 'pending' ? 'Chừa xác nhận' :
                   appointment.status === 'confirmed' ? 'Đã xác nhận' :
                   appointment.status === 'completed' ? 'Hoàn thành' :
                   'Đã hủy'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-gray-600 text-sm">📅 Ngày</p>
                  <p className="font-medium">{new Date(appointment.appointment_date).toLocaleDateString('vi-VN')}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">⏰ Giờ</p>
                  <p className="font-medium">{new Date(appointment.appointment_date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
