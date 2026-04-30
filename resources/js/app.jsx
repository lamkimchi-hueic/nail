import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../css/app.css';

const API_BASE_URL = ['5173', '5174', '5175'].includes(window.location.port)
  ? 'http://127.0.0.1:8000'
  : window.location.origin;

const DAY_LABELS = {
  monday: 'Thứ 2',
  tuesday: 'Thứ 3',
  wednesday: 'Thứ 4',
  thursday: 'Thứ 5',
  friday: 'Thứ 6',
  saturday: 'Thứ 7',
  sunday: 'Chủ nhật'
};

function getDefaultWorkingHours() {
  return {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '20:00', closed: false },
    saturday: { open: '10:00', close: '19:00', closed: false },
    sunday: { open: '10:00', close: '18:00', closed: true }
  };
}

function normalizeWorkingHours(rawHours) {
  const defaults = getDefaultWorkingHours();
  if (!rawHours || typeof rawHours !== 'object') return defaults;

  const normalized = { ...defaults };
  Object.keys(defaults).forEach((day) => {
    const item = rawHours?.[day] || {};
    normalized[day] = {
      open: item.open || defaults[day].open,
      close: item.close || defaults[day].close,
      closed: Boolean(item.closed)
    };
  });

  return normalized;
}

function formatWorkingHoursSummary(hours) {
  const normalized = normalizeWorkingHours(hours);
  return Object.keys(DAY_LABELS)
    .map((day) => {
      const value = normalized[day];
      if (value.closed) return `${DAY_LABELS[day]}: Nghỉ`;
      return `${DAY_LABELS[day]}: ${value.open} - ${value.close}`;
    })
    .join(' | ');
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function calculateCalendarDays(calendarMonth) {
  const month = calendarMonth.getMonth();
  const year = calendarMonth.getFullYear();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function getLocalDateTimeParts(dateTimeValue) {
  if (!dateTimeValue) {
    return { date: '', time: '09:00' };
  }

  const raw = String(dateTimeValue).trim();

  // Keep DB local datetime values unchanged to avoid timezone shifts.
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const [datePart, timePart] = raw.split(' ');
    return {
      date: datePart,
      time: (timePart || '09:00').slice(0, 5)
    };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '', time: '09:00' };
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`
  };
}

function resolveServiceImage(service) {
  const image = service?.image_url || service?.image;
  if (!image) return '';
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/storage/')) return `${API_BASE_URL}${image}`;
  return `${API_BASE_URL}/storage/${image}`;
}

function resolveHeroImage(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}

function App() {
  const AUTH_STORAGE_KEY = 'userAuth';

  const [auth, setAuthState] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.user?.role) return parsed;
      return null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  
  // Helper functions for cookie management
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  const setCookie = (name, value, days = 7) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  };

  const [adminPage, setAdminPageState] = useState(() => {
    return getCookie('adminPage') || 'dashboard';
  });

  const setAuth = (nextAuth) => {
    setAuthState(nextAuth);

    if (nextAuth?.user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  };

  // Save adminPage to cookie whenever it changes
  const setAdminPage = (page) => {
    setAdminPageState(page);
    setCookie('adminPage', page);
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const authToken = localStorage.getItem('auth_token');
        const res = await fetch(`${API_BASE_URL}/api/user`, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
          }
        });

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const data = await res.json();
        const userData = data?.data;
        if (userData?.role) {
          setAuth({ user: userData });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      console.error('OAuth error:', error);
      window.history.replaceState({}, document.title, window.location.pathname);
      setLoading(false);
      return;
    }

    if (token) {
      localStorage.setItem('auth_token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
      // Fetch user after OAuth
      fetchUser();
      return;
    }

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-lg font-semibold text-slate-700">Đang tải...</p>
      </div>
    );
  }

  if (!auth) {
    return showAuthForm ? (
      <LoginRegister
        setAuth={setAuth}
        initialMode={authMode}
        onBack={() => setShowAuthForm(false)}
      />
    ) : (
      <PublicHome
        onLoginClick={() => {
          setAuthMode('login');
          setShowAuthForm(true);
        }}
        onRegisterClick={() => {
          setAuthMode('register');
          setShowAuthForm(true);
        }}
      />
    );
  }

  const handleLogout = async () => {
    try {
      const authToken = localStorage.getItem('auth_token');
      if (authToken) {
        await fetch(`${API_BASE_URL}/api/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: { 
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        });
      }
    } finally {
      localStorage.removeItem('auth_token');
      setAuth(null);
    }
  };

  if (auth?.user?.role === 'admin') {
    return (
      <AdminPanel
        auth={auth}
        setAuth={setAuth}
        page={adminPage}
        setPage={setAdminPage}
      />
    );
  }

  return <PublicHome auth={auth} onLogoutClick={handleLogout} onLoginClick={() => setShowAuthForm(true)} onRegisterClick={() => { setAuthMode('register'); setShowAuthForm(true); }} />;
}

function PublicHome({ auth, setAuth, onLoginClick, onRegisterClick, onLogoutClick }) {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [salonSettings, setSalonSettings] = useState({
    salon_phone: '',
    working_hours: getDefaultWorkingHours()
  });
  const [booking, setBooking] = useState({
    name: '',
    phone: '',
    appointment_date: '',
    appointment_time: '09:00',
    service_ids: []
  });
  const [bookingStatus, setBookingStatus] = useState({ type: '', message: '' });
  const [lookupStatus, setLookupStatus] = useState({ type: '', message: '' });
  const [showTimeGrid, setShowTimeGrid] = useState(false);
  const [showLookupSection, setShowLookupSection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [dailySchedule, setDailySchedule] = useState([]);
  const [lookupPhone, setLookupPhone] = useState(auth?.user?.phone || '');
  
  useEffect(() => {
    if (auth?.user?.phone) {
      setLookupPhone(auth.user.phone);
    }
  }, [auth?.user?.phone]);

  const [customerAppointments, setCustomerAppointments] = useState([]);
  const [loadingCustomerAppointments, setLoadingCustomerAppointments] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [editForm, setEditForm] = useState({
    appointment_date: '',
    appointment_time: '09:00',
    service_ids: [],
    notes: ''
  });
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isServicePickerOpen, setIsServicePickerOpen] = useState(false);
  const servicePickerRef = useRef(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  
  useEffect(() => {
    if (auth) {
      fetchCustomerAppointments();
    }
  }, [auth]);

  useEffect(() => {
    const loadServices = async () => {
      setLoadingServices(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/services`, {
          headers: { Accept: 'application/json' }
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || [];
        setServices(list);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingServices(false);
      }
    };

    loadServices();
  }, []);

  useEffect(() => {
    const loadSalonSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/salon-settings`, {
          headers: { Accept: 'application/json' }
        });

        if (!res.ok) {
          console.error('❌ Salon settings API error:', res.status, res.statusText);
          return;
        }

        const data = await res.json();
        console.log('✅ Salon settings loaded:', data);
        const settings = data?.data || {};
        setSalonSettings({
          salon_phone: settings.salon_phone || '',
          working_hours: normalizeWorkingHours(settings.working_hours),
          hero_image: settings.hero_image || null
        });
      } catch (error) {
        console.error('❌ Salon settings fetch error:', error);
      }
    };

    loadSalonSettings();
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const minDate = today; // Allow booking from today

  const getAllTimeSlots = useMemo(() => (
    Array.from({ length: 12 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00`)
  ), []);

  // Get available time slots based on selected date
  const getAvailableTimeSlots = useMemo(() => {
    if (booking.appointment_date === today) {
      // For today, only show times after current time
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      return getAllTimeSlots.filter((slot) => {
        const [slotHour, slotMinute] = slot.split(':').map(Number);
        // Show slots that are at least 30 minutes in the future
        return (slotHour > currentHour) || (slotHour === currentHour && slotMinute >= currentMinute + 30);
      });
    }
    // For future dates, show all slots
    return getAllTimeSlots;
  }, [booking.appointment_date, today, getAllTimeSlots]);

  const timeSlots = getAvailableTimeSlots;

  const selectedServiceNames = useMemo(() => {
    return services
      .filter((service) => booking.service_ids.includes(service.id))
      .map((service) => service.name);
  }, [services, booking.service_ids]);

  const getCalendarDays = useMemo(() => calculateCalendarDays(calendarMonth), [calendarMonth]);

  const handleDateSelect = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    setBooking({ ...booking, appointment_date: dateStr });
    setShowCalendar(false);
  };

  const handleMonthChange = (direction) => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + direction, 1));
  };

  const toggleServiceSelection = (serviceId) => {
    setBooking((prev) => {
      const exists = prev.service_ids.includes(serviceId);
      if (exists) {
        return {
          ...prev,
          service_ids: prev.service_ids.filter((id) => id !== serviceId)
        };
      }

      return {
        ...prev,
        service_ids: [...prev.service_ids, serviceId]
      };
    });
  };

  const toggleEditServiceSelection = (serviceId) => {
    setEditForm((prev) => {
      const exists = prev.service_ids.includes(serviceId);
      if (exists) {
        return {
          ...prev,
          service_ids: prev.service_ids.filter((id) => id !== serviceId)
        };
      }

      return {
        ...prev,
        service_ids: [...prev.service_ids, serviceId]
      };
    });
  };

  useEffect(() => {
    if (!booking.appointment_date) {
      setBooking((prev) => ({ ...prev, appointment_date: minDate }));
    }
  }, [booking.appointment_date, minDate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (servicePickerRef.current && !servicePickerRef.current.contains(event.target)) {
        setIsServicePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!booking.appointment_date) return;

    const loadSchedule = async () => {
      setLoadingSchedule(true);
      try {
        console.log('📅 Loading schedule for date:', booking.appointment_date);
        const res = await fetch(`${API_BASE_URL}/api/appointments/schedule?date=${booking.appointment_date}`, {
          headers: { Accept: 'application/json' }
        });
        const data = await res.json();
        console.log('📅 Schedule API response:', data);
        const payload = data?.data || {};
        console.log('📅 Booked slots:', payload?.booked_slots);
        console.log('📅 Daily appointments:', payload?.appointments);
        setBookedSlots(payload?.booked_slots || []);
        setDailySchedule(payload?.appointments || []);
      } catch (error) {
        console.error('❌ Schedule loading error:', error);
      } finally {
        setLoadingSchedule(false);
      }
    };

    loadSchedule();
  }, [booking.appointment_date]);

  const submitBooking = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setBookingStatus({ type: '', message: '' });

    console.log('📋 Form Data:', {
      name: booking.name,
      phone: booking.phone,
      service_ids: booking.service_ids,
      appointment_date: booking.appointment_date,
      appointment_time: booking.appointment_time,
      timeSlots: timeSlots,
      bookedSlots: bookedSlots
    });

    if (booking.service_ids.length === 0 || !booking.appointment_date || !booking.appointment_time) {
      setSubmitting(false);
      const missing = [];
      if (booking.service_ids.length === 0) missing.push('Dịch vụ');
      if (!booking.appointment_date) missing.push('Ngày');
      if (!booking.appointment_time) missing.push('Giờ');
      
      const msg = `Vui lòng điền: ${missing.join(', ')}`;
      console.warn('❌ Missing fields:', msg);
      setBookingStatus({ type: 'error', message: msg });
      return;
    }

    if (bookedSlots.includes(booking.appointment_time)) {
      setSubmitting(false);
      setBookingStatus({ type: 'error', message: 'Khung giờ này đã được đặt. Vui lòng chọn giờ khác.' });
      return;
    }

    try {
      const payload = {
        appointment_date: `${booking.appointment_date} ${booking.appointment_time}:00`,
        staff_id: 1,
        services: booking.service_ids.map((id) => Number(id)),
        ...(booking.phone ? { phone: booking.phone } : {})
      };

      console.log('Booking payload:', payload);

      const authToken = localStorage.getItem('auth_token');

      const res = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      console.log('Booking response:', data);

      if (res.ok) {
        setBookingStatus({
          type: 'success',
          message: data?.message || 'Đặt lịch thành công. Salon sẽ liên hệ bạn sớm.'
        });
        setBooking((prev) => ({ ...prev, service_ids: [] }));

        if (lookupPhone && lookupPhone === booking.phone) {
          fetchCustomerAppointments(lookupPhone);
        }

        const refresh = await fetch(`${API_BASE_URL}/api/appointments/schedule?date=${booking.appointment_date}`, {
          headers: { Accept: 'application/json' }
        });
        const refreshed = await refresh.json();
        const payload = refreshed?.data || {};
        setBookedSlots(payload?.booked_slots || []);
        setDailySchedule(payload?.appointments || []);
      } else {
        // Handle validation errors with field details
        let errorMsg = data?.message || 'Không thể đặt lịch. Vui lòng thử lại.';
        
        // Add backend error details if available
        if (data?.error) {
          errorMsg += ` (${data.error})`;
        }
        
        // Add field-specific validation errors
        if (data?.errors) {
          const fieldErrors = Object.entries(data.errors)
            .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
            .join('\n');
          errorMsg = errorMsg + '\n' + fieldErrors;
        }
        
        console.error('❌ Booking failed:', errorMsg);
        setBookingStatus({
          type: 'error',
          message: errorMsg
        });
      }
    } catch (error) {
      console.error('Booking error:', error);
      setBookingStatus({
        type: 'error',
        message: 'Lỗi kết nối đến server. Vui lòng thử lại.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fetchCustomerAppointments = async (phoneParam = lookupPhone) => {
    if (!auth?.user && !phoneParam) {
      setLookupStatus({ type: 'error', message: 'Vui lòng nhập số điện thoại để tra cứu.' });
      return;
    }

    setLoadingCustomerAppointments(true);
    setLookupStatus({ type: '', message: '' });

    try {
      const authToken = localStorage.getItem('auth_token');
      let res;
      
      if (auth?.user && authToken) {
        res = await fetch(`${API_BASE_URL}/api/my-appointments`, {
          headers: { 
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        });
      } else {
        setLoadingCustomerAppointments(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setCustomerAppointments([]);
        setLookupStatus({ type: 'error', message: data?.message || 'Không thể tra cứu lịch hẹn.' });
        return;
      }

      const list = data?.data || [];
      setCustomerAppointments(list);
      setLookupStatus({
        type: 'success',
        message: list.length > 0 ? `Tìm thấy ${list.length} lịch hẹn.` : 'Không có lịch hẹn nào.'
      });
    } catch (error) {
      console.error(error);
      setLookupStatus({ type: 'error', message: 'Lỗi kết nối khi tra cứu lịch hẹn.' });
    } finally {
      setLoadingCustomerAppointments(false);
    }
  };

  const startEditingAppointment = (appointment) => {
    const dateTimeParts = getLocalDateTimeParts(appointment.appointment_date);
    setEditingAppointmentId(appointment.id);
    setEditForm({
      appointment_date: dateTimeParts.date,
      appointment_time: dateTimeParts.time,
      service_ids: (appointment.services || []).map((item) => Number(item.id)),
      notes: appointment.notes || ''
    });
  };

  const submitEditAppointment = async (appointmentId) => {
    const normalizedPhone = lookupPhone.trim();
    const authToken = localStorage.getItem('auth_token');

    if (!auth?.user && !normalizedPhone) {
      setLookupStatus({ type: 'error', message: 'Vui lòng nhập số điện thoại để cập nhật lịch.' });
      return;
    }

    if (!editForm.appointment_date || !editForm.appointment_time || editForm.service_ids.length === 0) {
      setLookupStatus({ type: 'error', message: 'Vui lòng nhập đủ ngày, giờ và chọn ít nhất 1 dịch vụ.' });
      return;
    }

    try {
      const payload = {
        appointment_date: `${editForm.appointment_date} ${editForm.appointment_time}:00`,
        services: editForm.service_ids,
        notes: editForm.notes
      };
      
      if (!auth?.user) {
        payload.phone = normalizedPhone;
      }

      const url = auth?.user && authToken
        ? `${API_BASE_URL}/api/my-appointments/${appointmentId}`
        : `${API_BASE_URL}/api/appointments/${appointmentId}`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(auth?.user && authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        let message = data?.message || 'Không thể cập nhật lịch hẹn.';
        if (data?.errors) {
          const details = Object.entries(data.errors)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join(' | ');
          if (details) {
            message = `${message} ${details}`;
          }
        }
        setLookupStatus({ type: 'error', message });
        return;
      }

      setLookupStatus({ type: 'success', message: data?.message || 'Đã cập nhật lịch hẹn thành công.' });
      alert('Cập nhật lịch hẹn thành công!');
      setEditingAppointmentId(null);
      fetchCustomerAppointments(lookupPhone);
    } catch (error) {
      console.error(error);
      setLookupStatus({ type: 'error', message: 'Lỗi kết nối khi cập nhật lịch hẹn.' });
    }
  };

  const deleteAppointmentByCustomer = async (appointmentId) => {
    const normalizedPhone = lookupPhone.trim();
    const authToken = localStorage.getItem('auth_token');

    if (!auth?.user && !normalizedPhone) {
      setLookupStatus({ type: 'error', message: 'Vui lòng nhập số điện thoại để xóa lịch.' });
      return;
    }

    if (!window.confirm('Xóa lịch hẹn này khỏi hệ thống?')) return;

    try {
      const url = auth?.user && authToken
        ? `${API_BASE_URL}/api/my-appointments/${appointmentId}`
        : `${API_BASE_URL}/api/appointments/${appointmentId}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(auth?.user && authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: !auth?.user ? JSON.stringify({ phone: normalizedPhone }) : undefined
      });

      const data = await res.json();
      if (!res.ok) {
        setLookupStatus({ type: 'error', message: data?.message || 'Không thể xóa lịch hẹn.' });
        return;
      }

      setLookupStatus({ type: 'success', message: data?.message || 'Đã xóa lịch hẹn.' });
      if (editingAppointmentId === appointmentId) {
        setEditingAppointmentId(null);
      }
      fetchCustomerAppointments(lookupPhone);
    } catch (error) {
      console.error(error);
      setLookupStatus({ type: 'error', message: 'Lỗi kết nối khi xóa lịch hẹn.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#08050c] text-[#f8e7d9]">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
        <nav className="rounded-xl border border-[#7f5c44]/40 bg-[#140d1f]/90 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="leading-tight">
              <p className="text-xs font-semibold tracking-[0.25em] text-[#d7b17a]">LUXURY</p>
              <p className="text-lg font-black tracking-wide text-[#f7d9b2]">NAILS SPA</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#e5d2c4] md:text-sm">
              <a href="#dich-vu" className="hover:text-white">Dịch vụ</a>
              <a href="#bo-suu-tap" className="hover:text-white">Bộ sưu tập</a>
              <a href="#gio-lam" className="hover:text-white">Giờ làm việc</a>
              <a href="#lien-he" className="hover:text-white">Liên hệ</a>
              {auth ? (
                <div className="flex items-center gap-3">
                  <span className="text-[#f7d9b2]">Xin chào {auth.user?.name || auth.user?.username}</span>
                  <button
                    onClick={onLogoutClick}
                    className="rounded-md border border-[#8d6a52] px-3 py-2 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                  >
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={onLoginClick}
                    className="rounded-md border border-[#8d6a52] px-3 py-2 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                  >
                    Đăng nhập
                  </button>
                  <button
                    onClick={onRegisterClick}
                    className="rounded-md border border-[#8d6a52] px-3 py-2 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                  >
                    Đăng ký
                  </button>
                </>
              )}
              <button
                onClick={() => document.getElementById('dat-lich')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-md bg-[#eec8be] px-3 py-2 text-[#2a1623] hover:bg-[#ffd9cf]"
              >
                Đặt lịch ngay
              </button>
            </div>
          </div>
        </nav>

        <section id="trang-chu" className="mt-4 rounded-2xl border border-[#7f5c44]/40 bg-[#0b0712]">
          <div className="grid gap-6 md:grid-cols-[1.6fr_1fr]">
            <div className="relative min-h-[50vh] md:min-h-[60vh] lg:min-h-[70vh] border-b border-[#7f5c44]/30 md:border-b-0 md:border-r overflow-hidden">
              {salonSettings.hero_image?.url ? (
                <>
                  <img
                    src={resolveHeroImage(salonSettings.hero_image.url)}
                    alt="Hero"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-black/40" />
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,#2b1b27_0%,#0b0712_55%)]" />
                  <div className="absolute -left-8 bottom-0 h-56 w-56 rounded-full bg-[#e9b7b8]/20 blur-3xl" />
                  <div className="absolute right-8 top-8 h-32 w-32 rounded-full bg-[#d5a56a]/25 blur-2xl" />
                </>
              )}

              <div className="relative z-10 flex h-full flex-col justify-start px-6 pt-[20px] pb-8 md:px-10">
                <p className="mb-3 text-sm uppercase tracking-[0.3em] text-[#d5a56a]">Luxury Nails Spa</p>
                <h1 className="mb-3 text-3xl font-black leading-tight text-[#f8e7d9] md:text-5xl">
                  Nâng tầm vẻ đẹp
                  <span className="block text-[#f4c0c4]">đôi tay bạn</span>
                </h1>
                <p className="max-w-xl text-sm text-[#cfbec0] md:text-base">
                  Trải nghiệm dịch vụ nail cao cấp trong không gian sang trọng. Đặt lịch nhanh, xác nhận sớm,
                  linh hoạt theo thời gian của bạn.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => document.getElementById('dat-lich')?.scrollIntoView({ behavior: 'smooth' })}
                    className="rounded-md bg-[#f2d3c8] px-5 py-3 text-sm font-bold uppercase tracking-wide text-[#291726] hover:bg-[#ffe3d9]"
                  >
                    Đặt lịch hẹn ngay
                  </button>
                </div>
              </div>
            </div>

            <aside id="dat-lich" className="p-4 md:p-6">
              <div className="rounded-xl border border-[#8d6a52]/40 bg-[#140d1f] p-4 shadow-2xl shadow-black/30">
                <h3 className="text-lg font-black uppercase tracking-wide text-[#f6d6b1]">Đặt lịch trực tuyến</h3>
                {auth ? (
                  <p className="mt-1 text-xs text-[#ccb7b8]">Điền thông tin để salon liên hệ xác nhận lịch.</p>
                ) : (
                  <p className="mt-1 text-xs text-amber-400">Vui lòng đăng nhập để đặt lịch.</p>
                )}

                {auth ? (
                  <form onSubmit={submitBooking} className="mt-4 space-y-3">
                    <input
                      type="text"
                      disabled
                      value={auth.user?.name || auth.user?.username || ''}
                      className="w-full rounded-md border border-[#6f5262] bg-[#1a0f24] px-3 py-2 text-sm text-[#99878e] outline-none cursor-not-allowed"
                    />
                    <input
                      type="text"
                      disabled={!!auth.user?.phone}
                      value={auth.user?.phone || booking.phone}
                      onChange={(e) => !auth.user?.phone && setBooking({ ...booking, phone: e.target.value })}
                      placeholder={auth.user?.phone ? '' : 'Vui lòng nhập số điện thoại để đặt lịch'}
                      required={!auth.user?.phone}
                      className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring ${
                        auth.user?.phone 
                          ? 'border-[#6f5262] bg-[#1a0f24] text-[#99878e] cursor-not-allowed' 
                          : 'border-[#6f5262] bg-[#0f0a17] text-white ring-[#d8a56c] focus:border-[#d8a56c]'
                      }`}
                    />
                    <div className="relative" ref={servicePickerRef}>
                    <button
                      type="button"
                      onClick={() => setIsServicePickerOpen((prev) => !prev)}
                      className="w-full rounded-md border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-left text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#d8a56c]">Chọn dịch vụ</p>
                      <p className="mt-1 text-xs text-[#cbb9bb]">
                        {selectedServiceNames.length > 0
                          ? selectedServiceNames.join(', ')
                          : 'Click vào ô để chọn nhiều dịch vụ'}
                      </p>
                      <p className="mt-1 text-xs text-[#cbb9bb]">
                        Đã chọn: <span className="font-bold text-[#f6d6b1]">{booking.service_ids.length}</span> dịch vụ
                      </p>
                    </button>

                    {isServicePickerOpen && (
                      <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-[#8d6a52] bg-[#1a0f27] p-3 shadow-xl">
                        {loadingServices ? (
                          <p className="text-xs text-[#cbb9bb]">Đang tải dịch vụ...</p>
                        ) : services.length === 0 ? (
                          <p className="text-xs text-[#cbb9bb]">Chưa có dịch vụ để chọn.</p>
                        ) : (
                          <div className="max-h-48 space-y-2 overflow-auto pr-1">
                            {services.map((service) => {
                              const checked = booking.service_ids.includes(service.id);
                              return (
                                <label
                                  key={service.id}
                                  className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                                    checked
                                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                      : 'border-[#6f5262] bg-[#120b1c] text-[#f8e7d9] hover:border-[#8d6a52]'
                                  }`}
                                >
                                  <span>{service.name}</span>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleServiceSelection(service.id)}
                                    className="h-4 w-4 accent-[#f0c6bb]"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Date Picker */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="w-full rounded-md border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring text-left"
                    >
                      📅 {formatDisplayDate(booking.appointment_date) || 'Chọn ngày'}
                    </button>
                    
                    {showCalendar && (
                      <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-[#8d6a52] bg-[#1a0f27] p-3 shadow-xl">
                        <div className="mb-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleMonthChange(-1)}
                            className="rounded px-2 py-1 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                          >
                            ‹
                          </button>
                          <div className="text-center text-sm font-bold text-[#f7d9b2]">
                            {calendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMonthChange(1)}
                            className="rounded px-2 py-1 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                          >
                            ›
                          </button>
                        </div>

                        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#d8a56c]">
                          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                            <div key={day}>{day}</div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {getCalendarDays.map((date, i) => {
                            let dateStr = null;
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              dateStr = `${year}-${month}-${day}`;
                            }
                            const isDisabled = date && dateStr < minDate;
                            const isSelected = dateStr === booking.appointment_date;
                            
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={!date || isDisabled}
                                onClick={() => date && handleDateSelect(date)}
                                className={`rounded px-1 py-1 text-xs font-semibold ${
                                  !date || isDisabled
                                    ? 'text-[#6f5262]'
                                    : isSelected
                                    ? 'bg-[#f7d9b2] text-[#2a1724]'
                                    : 'bg-[#2a1d2f] text-[#f7d9b2] hover:bg-[#3a2d3f]'
                                }`}
                              >
                                {date?.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Time Picker Trigger */}
                  <div className="relative mt-3">
                    <button
                      type="button"
                      onClick={() => setShowTimeGrid(!showTimeGrid)}
                      className="w-full rounded-md border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring text-left flex justify-between items-center"
                    >
                      <span>🕒 {booking.appointment_time || 'Chọn khung giờ'}</span>
                      <span className="text-xs text-[#99878e]">{showTimeGrid ? '▲' : '▼'}</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-md bg-[#f0c6bb] px-4 py-2 text-sm font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf] disabled:opacity-60"
                  >
                    {submitting ? 'Đang gửi...' : 'Hoàn tất đặt lịch'}
                  </button>

                  {bookingStatus.message && (
                    <div className={`rounded px-3 py-2 text-xs font-semibold whitespace-pre-wrap break-words ${
                      bookingStatus.type === 'success' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      {bookingStatus.message}
                    </div>
                  )}
                </form>
                  ) : null}

                {bookingStatus.type !== 'success' && showTimeGrid && (
                <div className="mt-4 rounded-xl border border-[#8d6a52]/35 bg-[#100a18] p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <h4 className="text-sm font-black uppercase tracking-wide text-[#f7d9b2]">Chọn khung giờ - Ngày {formatDisplayDate(booking.appointment_date) || '--/--/----'}</h4>
                  <p className="mt-1 text-xs text-[#cbb9bb]">
                    Khung đỏ là đã đặt, khung xanh là còn trống. Hãy click để chọn.
                    {booking.appointment_date === today && (
                      <span className="block mt-1 text-amber-300">
                        ⚠️ Hôm nay: Chỉ có thể đặt từ 30 phút kế tiếp
                      </span>
                    )}
                  </p>

                  {loadingSchedule ? (
                    <p className="mt-3 text-xs text-[#cbb9bb]">Đang tải lịch...</p>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {timeSlots.map((slot) => {
                        const isBooked = bookedSlots.includes(slot);
                        const isSelected = booking.appointment_time === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={isBooked}
                            onClick={() => {
                              if (!isBooked) {
                                setBooking({ ...booking, appointment_time: slot });
                                setShowTimeGrid(false);
                              }
                            }}
                            className={`rounded-md border px-2 py-3 text-center text-xs font-bold transition-all ${
                              isBooked
                                ? 'cursor-not-allowed border-rose-400/60 bg-rose-500/20 text-rose-200 opacity-50'
                                : isSelected
                                ? 'border-amber-400 bg-amber-500/30 text-amber-100'
                                : 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                            }`}
                          >
                            {slot}
                            {isSelected && ' ✓'}
                          </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-3 max-h-28 overflow-auto pr-1 text-xs text-[#cab7ba]">
                        {dailySchedule.length === 0 ? (
                          <p>Chưa có lịch hẹn nào trong ngày này.</p>
                        ) : (
                          dailySchedule.map((item) => (
                            <p key={item.id} className="py-1">
                              {item.time} • {item.customer_name} • {(item.services || []).join(', ')}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                {auth?.user && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowLookupSection(!showLookupSection)}
                    className="w-full rounded-xl border border-[#8d6a52]/40 bg-[#140d1f] p-4 text-left flex justify-between items-center hover:bg-[#1a1226] transition-all"
                  >
                    <span className="text-sm font-black uppercase tracking-wide text-[#f7d9b2]">🗓️ Lịch đã đặt</span>
                    <span className="text-xs text-[#99878e]">{showLookupSection ? '▲' : '▼'}</span>
                  </button>

                  {showLookupSection && (
                    <div className="mt-2 rounded-xl border border-[#8d6a52]/35 bg-[#100a18] p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <h4 className="text-sm font-black uppercase tracking-wide text-[#f7d9b2]">Tra cứu và cập nhật lịch đã đặt</h4>

                      <div className="mt-3 flex gap-2">
                        <div className="w-full rounded-md border border-[#6f5262] bg-[#1a0f24] px-3 py-2 text-sm text-[#99878e]">
                          Lịch hẹn cá nhân của bạn
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchCustomerAppointments()}
                          className="rounded-md border border-[#8d6a52] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#f3d5b8] hover:bg-[#2a1d2f] whitespace-nowrap"
                        >
                          Làm mới
                        </button>
                      </div>

                      {lookupStatus.message && (
                        <p className={`mt-3 text-xs font-semibold ${lookupStatus.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {lookupStatus.message}
                        </p>
                      )}

                      <div className="mt-3 space-y-3">
                        {loadingCustomerAppointments ? (
                          <p className="text-xs text-[#cbb9bb]">Đang tải lịch hẹn...</p>
                        ) : (
                          customerAppointments.map((apt) => {
                            const dateTimeParts = getLocalDateTimeParts(apt.appointment_date);

                            return (
                            <div key={apt.id} className="rounded-lg border border-[#7f5c44]/30 bg-[#170f22]/50 p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-black text-[#f7dfc2]">
                                    {dateTimeParts.time} {formatDisplayDate(dateTimeParts.date)} - <span className="italic opacity-80">{apt.status}</span>
                                  </p>
                                  <p className="mt-0.5 text-xs text-[#cbb9bb]">
                                    Dịch vụ: {(apt.services || []).map((s) => s.name).join(', ')}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(apt)}
                                  className="rounded-md border border-[#8d6a52] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#f3d5b8] hover:bg-[#2a1d2f]"
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteAppointmentByCustomer(apt.id)}
                                  className="rounded-md border border-rose-500/50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-300 hover:bg-rose-500/20"
                                >
                                  Xóa
                                </button>
                              </div>

                              {editingAppointmentId === apt.id && (
                                <div className="mt-3 rounded-md border border-[#6f5262] bg-[#0f0a17] p-3">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#d8a56c]">Cập nhật lịch hẹn</p>

                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="date"
                                      value={editForm.appointment_date}
                                      onChange={(e) => setEditForm((prev) => ({ ...prev, appointment_date: e.target.value }))}
                                      className="rounded-md border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-xs text-white outline-none ring-[#d8a56c] focus:ring"
                                    />
                                    <input
                                      type="time"
                                      value={editForm.appointment_time}
                                      onChange={(e) => setEditForm((prev) => ({ ...prev, appointment_time: e.target.value }))}
                                      className="rounded-md border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-xs text-white outline-none ring-[#d8a56c] focus:ring"
                                    />
                                  </div>

                                  <div className="mt-2 max-h-36 space-y-2 overflow-auto pr-1">
                                    {services.map((service) => {
                                      const checked = editForm.service_ids.includes(service.id);
                                      return (
                                        <label
                                          key={service.id}
                                          className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-xs ${
                                            checked
                                              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                              : 'border-[#6f5262] bg-[#120b1c] text-[#f8e7d9]'
                                          }`}
                                        >
                                          <span>{service.name}</span>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleEditServiceSelection(service.id)}
                                            className="h-4 w-4 accent-[#f0c6bb]"
                                          />
                                        </label>
                                      );
                                    })}
                                  </div>

                                  <textarea
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Ghi chú (không bắt buộc)"
                                    className="mt-2 w-full rounded-md border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-xs text-white outline-none ring-[#d8a56c] focus:ring"
                                  />

                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => submitEditAppointment(apt.id)}
                                      className="rounded-md bg-[#f0c6bb] px-3 py-2 text-xs font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]"
                                    >
                                      Cập nhật
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingAppointmentId(null)}
                                      className="rounded-md border border-[#8d6a52] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#f3d5b8] hover:bg-[#2a1d2f]"
                                    >
                                      Hủy sửa
                                    </button>
                                  </div>
                                </div>
                                  )}
                              </div>
                              )
                            })
                          )}
                        </div>
                    </div>
                  )}
                </div>
              )}
              </div>
            </aside>
          </div>
        </section>

        <section id="dich-vu" className="mt-6 rounded-2xl border border-[#7f5c44]/40 bg-[#0b0712] p-5 md:p-7">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-black uppercase tracking-wide text-[#f7d9b2]">Dịch vụ nổi bật</h2>
            <button onClick={onLoginClick} className="text-xs font-semibold uppercase tracking-wide text-[#f4c0c4] hover:text-white">
              Xem tất cả
            </button>
          </div>

          {loadingServices ? (
            <p className="text-sm text-[#c8b4b6]">Đang tải dịch vụ...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {services.slice(0, 3).map((service) => (
                <article key={service.id} className="rounded-xl border border-[#8d6a52]/40 bg-[#170f22] p-3">
                  {resolveServiceImage(service) ? (
                    <img
                      src={resolveServiceImage(service)}
                      alt={service.name}
                      className="h-28 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-28 rounded-lg bg-[linear-gradient(135deg,#e4b7bf_0%,#f0d8c8_45%,#2a1a28_100%)]" />
                  )}
                  <h3 className="mt-3 text-lg font-black text-[#f7dfc2]">{service.name}</h3>
                  <p className="mt-1 text-sm text-[#c7b4b6] line-clamp-2">{service.description || 'Dịch vụ chuyên nghiệp cho bộ móng đẹp bền.'}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-[#d8a56c]">{service.price}k</p>
                    <button className="rounded-md border border-[#8d6a52] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#f3d5b8] hover:bg-[#2a1d2f]">
                      Xem chi tiết
                    </button>
                  </div>
                </article>
              ))}
              {services.length === 0 && <p className="text-sm text-[#c8b4b6]">Chưa có dịch vụ hiển thị.</p>}
            </div>
          )}
        </section>

        <section id="bo-suu-tap" className="mt-6 rounded-2xl border border-[#7f5c44]/40 bg-[#0b0712] p-5 md:p-7">
          <h2 className="text-2xl font-black uppercase tracking-wide text-[#f7d9b2]">Quy trình đặt lịch</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              'Chọn dịch vụ',
              'Chọn giờ phù hợp',
              'Xác nhận lịch hẹn'
            ].map((step, idx) => (
              <div key={step} className="relative rounded-lg border border-[#8d6a52]/35 bg-[#160f20] p-4 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-[#d8a56c] text-sm font-black text-[#f7d9b2]">
                  {idx + 1}
                </div>
                <p className="text-sm font-semibold text-[#d7c4c6]">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <footer id="gio-lam" className="mt-6 rounded-2xl border border-[#7f5c44]/40 bg-[#120b1c] p-5 text-sm text-[#bfaeb0]">
          <p className="mb-2"><span className="font-bold text-[#f6d6b1]">Giờ làm việc:</span> {formatWorkingHoursSummary(salonSettings.working_hours)}</p>
          <p id="lien-he"><span className="font-bold text-[#f6d6b1]">Liên hệ:</span> {salonSettings.salon_phone || 'Đang cập nhật'}</p>
        </footer>
      </div>
    </div>
  );
}

function LoginRegister({ setAuth, onBack, initialMode = 'login' }) {
  const [isLogin, setIsLogin] = useState(initialMode !== 'register');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    password_confirmation: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setIsLogin(initialMode !== 'register');
  }, [initialMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const url = isLogin
      ? `${API_BASE_URL}/api/login`
      : `${API_BASE_URL}/api/register`;

    const payload = isLogin
      ? { username: formData.username, password: formData.password }
      : {
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          password_confirmation: formData.password_confirmation,
          role: 'customer'
        };

    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const responseUser = data?.user || data?.data?.user || null;
      const responseToken = data?.token || data?.data?.token || null;

      if (!res.ok) {
        if (data?.errors) {
          // Get the first error message from any field
          const firstError = Object.values(data.errors).flat()[0];
          setError(firstError || data?.message || 'Đăng ký thất bại.');
        } else {
          setError(data?.message || 'Đăng ký thất bại.');
        }
        return;
      }

      if (!responseUser) {
        setError('Phản hồi đăng nhập không hợp lệ.');
        return;
      }

      if (responseToken) {
        localStorage.setItem('auth_token', responseToken);
      }

      setAuth({ user: responseUser, token: responseToken });
    } catch (error) {
      setError('Không thể kết nối đến máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08050c] p-4 text-[#f8e7d9]">
      <div className="absolute -left-8 top-16 h-56 w-56 rounded-full bg-[#e9b7b8]/20 blur-3xl" />
      <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#d5a56a]/15 blur-3xl" />

      <div className="relative w-full max-w-md rounded-2xl border border-[#8d6a52]/40 bg-[#140d1f]/95 p-6 shadow-2xl shadow-black/40">
        <button onClick={onBack} className="mb-4 text-sm font-bold text-[#d7c4c6] hover:text-white">
          ← Về trang chủ
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d5a56a]">Luxury Nails Spa</p>
        <h1 className="mb-1 mt-2 text-3xl font-black text-[#f7dfc2]">{isLogin ? 'Đăng nhập' : 'Đăng ký'}</h1>
        <p className="mb-6 text-[#cbb9bb]">{isLogin ? 'Đăng nhập để đặt lịch và quản lý' : 'Tạo tài khoản để đặt lịch'}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            type="text"
            placeholder="Username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full rounded-xl border border-[#6f5262] bg-[#0f0a17] px-4 py-3 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
          />

          {!isLogin && (
            <input
              required
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-xl border border-[#6f5262] bg-[#0f0a17] px-4 py-3 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
            />
          )}

          {!isLogin && (
            <input
              type="text"
              placeholder="Số điện thoại"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full rounded-xl border border-[#6f5262] bg-[#0f0a17] px-4 py-3 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
            />
          )}

          <div className="relative">
            <input
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="Mật khẩu"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-xl border border-[#6f5262] bg-[#0f0a17] px-4 py-3 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#99878e] hover:text-[#f0c6bb]"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          {!isLogin && (
            <div className="relative">
              <input
                required
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Xác nhận mật khẩu"
                value={formData.password_confirmation}
                onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                className="w-full rounded-xl border border-[#6f5262] bg-[#0f0a17] px-4 py-3 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#99878e] hover:text-[#f0c6bb]"
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          )}

          {error && <p className="text-sm font-semibold text-[#ff9aa7]">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#f0c6bb] py-3 font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf] disabled:opacity-60"
          >
            {submitting ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
          </button>

          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#6f5262]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#1a0f1d] text-[#99878e]">Hoặc</span>
              </div>
            </div>

            <a
              href={`${API_BASE_URL}/api/auth/google`}
              className="w-full rounded-xl border border-[#6f5262] bg-[#0f0a17] py-3 px-4 font-bold uppercase tracking-wide text-[#f0c6bb] hover:bg-[#1a0f1d] flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isLogin ? 'Đăng nhập với Google' : 'Đăng ký với Google'}
            </a>
          </>
        </form>

        <p className="mt-6 text-center text-sm text-[#cbb9bb]">
          {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 font-bold text-[#f4c0c4] hover:text-white"
          >
            {isLogin ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </p>

        <div className="mt-5 rounded-lg border border-[#8d6a52]/30 bg-[#100a18] p-3 text-xs text-[#bfaeb0]">
          <p className="font-bold text-[#f7d9b2]">Tài khoản demo</p>
          <p className="mt-1">Admin: admin / 123456</p>
          <p>Customer: customer1 / password</p>
        </div>
      </div>
    </div>
  );
}

function CustomerDashboard({ auth, setAuth }) {
  const [services, setServices] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState('services');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'services') {
      fetchServices();
    } else {
      fetchMyAppointments();
    }
  }, [activeTab]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/services`, {
        headers: { Accept: 'application/json' }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data || [];
      setServices(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchMyAppointments = async () => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE_URL}/api/my-appointments`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data || [];
      setMyAppointments(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('adminAuth');
      setAuth(null);
    }
  };

  return (
    <div>
      <nav className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-indigo-600">Nail Salon</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-700">Xin chào {auth.user.username}</span>
          <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
            Đăng xuất
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('services')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              activeTab === 'services'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Dịch vụ
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`px-6 py-2 rounded-lg font-semibold transition ${
              activeTab === 'appointments'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Lịch hẹn
          </button>
        </div>

        {loading ? (
          <p className="text-center text-xl">Đang tải...</p>
        ) : activeTab === 'services' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div key={service.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition">
                <h3 className="text-xl font-bold text-indigo-600 mb-2">{service.name}</h3>
                <p className="text-gray-600 mb-4">{service.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-green-600">
                    {(service.price * 1000).toLocaleString('vi-VN')} d
                  </span>
                  <span className="text-sm text-gray-500">{service.duration} phút</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {myAppointments.length === 0 ? (
              <p className="text-center text-gray-600 text-lg">Chưa có lịch hẹn nào</p>
            ) : (
              myAppointments.map((apt) => (
                <div key={apt.id} className="bg-white rounded-lg shadow-md p-6 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-lg">{apt.staff_name || 'N/A'}</p>
                    <p className="text-gray-600">
                      {new Date(apt.appointment_date).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <span className="px-4 py-2 rounded-lg font-semibold bg-blue-100 text-blue-800">
                    {apt.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPanel({ auth, setAuth, page, setPage }) {
  const [services, setServices] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', duration: '' });
  const [imageFile, setImageFile] = useState(null);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [serviceFormMessage, setServiceFormMessage] = useState({ type: '', text: '' });
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editServiceForm, setEditServiceForm] = useState({ name: '', description: '', price: '', duration: '' });
  const [editServiceImageFile, setEditServiceImageFile] = useState(null);
  const [editServiceImageKey, setEditServiceImageKey] = useState(0);
  const [settingsForm, setSettingsForm] = useState({
    salon_phone: '',
    working_hours: getDefaultWorkingHours()
  });
  const [salonSettings, setSalonSettings] = useState({
    hero_image: null
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState({ type: '', text: '' });
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [heroImageMessage, setHeroImageMessage] = useState({ type: '', text: '' });
  const [heroSelectedFileName, setHeroSelectedFileName] = useState('Chưa chọn ảnh');
  const heroFileInputRef = useRef(null);
  const [appointmentMessage, setAppointmentMessage] = useState({ type: '', text: '' });
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState(null);
  const [newAppointmentForm, setNewAppointmentForm] = useState({
    name: '',
    phone: '',
    staff_id: '1',
    appointment_date: '',
    appointment_time: '09:00',
    service_ids: [],
    notes: ''
  });

  const [editAppointmentForm, setEditAppointmentForm] = useState({
    staff_id: '1',
    appointment_date: '',
    appointment_time: '09:00',
    service_ids: [],
    status: 'pending',
    notes: ''
  });

  const [isNewAptServicePickerOpen, setIsNewAptServicePickerOpen] = useState(false);
  const [isEditAptServicePickerOpen, setIsEditAptServicePickerOpen] = useState(false);
  const newAptServicePickerRef = useRef(null);
  const editAptServicePickerRef = useRef(null);

  const [showNewAptCalendar, setShowNewAptCalendar] = useState(false);
  const [showEditAptCalendar, setShowEditAptCalendar] = useState(false);
  const [newAptCalendarMonth, setNewAptCalendarMonth] = useState(new Date());
  const [editAptCalendarMonth, setEditAptCalendarMonth] = useState(new Date());

  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [dailySchedule, setDailySchedule] = useState([]);
  const [showNewAptTimeGrid, setShowNewAptTimeGrid] = useState(false);
  const [showEditAptTimeGrid, setShowEditAptTimeGrid] = useState(false);

  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ name: '', username: '', email: '', phone: '', password: '', role: 'customer' });
  const [userMessage, setUserMessage] = useState({ type: '', text: '' });
  const [editingUserId, setEditingUserId] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', username: '', email: '', phone: '', password: '', role: 'customer' });
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [showEditUserPassword, setShowEditUserPassword] = useState(false);

  const EXPIRED_TOKEN_MESSAGE = 'Vui lòng thoát và đăng nhập lại';

  const getAuthHeaders = (extraHeaders = {}) => {
    const authToken = localStorage.getItem('auth_token');

    return {
      Accept: 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...extraHeaders
    };
  };

  useEffect(() => {
    if (page === 'services') {
      fetchServices();
    } else if (page === 'appointments') {
      fetchServices();
      fetchStaffs();
      fetchAppointments();
    } else if (page === 'settings') {
      fetchSalonSettings();
    } else if (page === 'users') {
      fetchUsers();
    }
  }, [page]);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (newAptServicePickerRef.current && !newAptServicePickerRef.current.contains(event.target)) {
        setIsNewAptServicePickerOpen(false);
      }
      if (editAptServicePickerRef.current && !editAptServicePickerRef.current.contains(event.target)) {
        setIsEditAptServicePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const selectedDate = newAppointmentForm.appointment_date || editAppointmentForm.appointment_date;
    if (!selectedDate) return;

    const loadSchedule = async () => {
      setLoadingSchedule(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/appointments/schedule?date=${selectedDate}`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        const payload = data?.data || {};
        setBookedSlots(payload?.booked_slots || []);
        setDailySchedule(payload?.appointments || []);
      } catch (error) {
        console.error('❌ Schedule loading error:', error);
      } finally {
        setLoadingSchedule(false);
      }
    };

    loadSchedule();
  }, [newAppointmentForm.appointment_date, editAppointmentForm.appointment_date]);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const getAllTimeSlots = useMemo(() => (
    Array.from({ length: 12 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00`)
  ), []);

  const getAvailableTimeSlots = (selectedDate) => {
    if (selectedDate === today) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      return getAllTimeSlots.filter((slot) => {
        const [slotHour, slotMinute] = slot.split(':').map(Number);
        return (slotHour > currentHour) || (slotHour === currentHour && slotMinute >= currentMinute + 30);
      });
    }
    return getAllTimeSlots;
  };

  const handleNewAptDateSelect = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    setNewAppointmentForm((prev) => ({ ...prev, appointment_date: dateStr }));
    setShowNewAptCalendar(false);
  };

  const handleEditAptDateSelect = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    setEditAppointmentForm((prev) => ({ ...prev, appointment_date: dateStr }));
    setShowEditAptCalendar(false);
  };

  const handleMonthChangeHelper = (setter, currentMonth, increment) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + increment);
    setter(newMonth);
  };

  const toggleNewAppointmentService = (serviceId) => {
    setNewAppointmentForm((prev) => {
      const exists = prev.service_ids.includes(serviceId);
      if (exists) {
        return { ...prev, service_ids: prev.service_ids.filter((id) => id !== serviceId) };
      }
      return { ...prev, service_ids: [...prev.service_ids, serviceId] };
    });
  };

  const toggleEditAppointmentService = (serviceId) => {
    setEditAppointmentForm((prev) => {
      const exists = prev.service_ids.includes(serviceId);
      if (exists) {
        return { ...prev, service_ids: prev.service_ids.filter((id) => id !== serviceId) };
      }
      return { ...prev, service_ids: [...prev.service_ids, serviceId] };
    });
  };

  const fetchSalonSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/salon-settings`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setSettingsMessage({ type: 'error', text: EXPIRED_TOKEN_MESSAGE });
          return;
        }

        setSettingsMessage({ type: 'error', text: data?.message || 'Không thể tải cài đặt salon.' });
        return;
      }

      const payload = data?.data || {};
      setSettingsForm({
        salon_phone: payload.salon_phone || '',
        working_hours: normalizeWorkingHours(payload.working_hours)
      });
      setSalonSettings({
        hero_image: payload.hero_image || null
      });
      setSettingsMessage({ type: '', text: '' });
    } catch (error) {
      console.error(error);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối khi tải cài đặt salon.' });
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) setUsers(data.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    setUserMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(userForm)
      });
      const data = await res.json();
      if (res.ok) {
        setUserMessage({ type: 'success', text: 'Thêm người dùng thành công' });
        setUserForm({ name: '', username: '', email: '', phone: '', password: '', role: 'customer' });
        fetchUsers();
      } else {
        setUserMessage({ type: 'error', text: data.message || 'Lỗi khi thêm người dùng' });
      }
    } catch (error) {
      setUserMessage({ type: 'error', text: 'Lỗi kết nối' });
    }
  };

  const updateUser = async (id) => {
    setUserMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(editUserForm)
      });
      const data = await res.json();
      if (res.ok) {
        setUserMessage({ type: 'success', text: 'Cập nhật thành công' });
        setEditingUserId(null);
        fetchUsers();
      } else {
        setUserMessage({ type: 'error', text: data.message || 'Lỗi khi cập nhật' });
      }
    } catch (error) {
      setUserMessage({ type: 'error', text: 'Lỗi kết nối' });
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setUserMessage({ type: 'success', text: 'Đã xóa người dùng thành công.' });
        fetchUsers();
      } else {
        setUserMessage({ type: 'error', text: data.message || 'Lỗi khi xóa người dùng.' });
      }
    } catch (error) {
      console.error(error);
      setUserMessage({ type: 'error', text: 'Lỗi kết nối khi xóa người dùng.' });
    }
  };

  const startEditUser = (user) => {
    setEditingUserId(user.id);
    setEditUserForm({
      name: user.name || '',
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role: user.role || 'customer'
    });
  };

  const updateWorkingHourValue = (dayKey, field, value) => {
    setSettingsForm((prev) => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [dayKey]: {
          ...prev.working_hours[dayKey],
          [field]: value
        }
      }
    }));
  };

  const uploadHeroImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setHeroSelectedFileName(file.name);

    setHeroImageUploading(true);
    setHeroImageMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`${API_BASE_URL}/api/salon-settings/upload-hero`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;
      if (!res.ok) {
        if (res.status === 401) {
          setHeroImageMessage({ type: 'error', text: EXPIRED_TOKEN_MESSAGE });
          return;
        }

        const fallbackMessage = data?.message || (contentType.includes('text/html') ? 'Máy chủ trả về trang HTML thay vì JSON. Hãy kiểm tra đăng nhập hoặc log backend.' : 'Không thể tải ảnh hero.');
        setHeroImageMessage({ type: 'error', text: fallbackMessage });
        return;
      }

      setHeroImageMessage({ type: 'success', text: data?.message || 'Ảnh hero được tải lên thành công.' });
      
      // Reload public salon settings to display new hero image
      try {
        const settingsRes = await fetch(`${API_BASE_URL}/api/admin/salon-settings`, {
          credentials: 'include',
          headers: getAuthHeaders()
        });
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          const settings = settingsData?.data || {};
          setSalonSettings((prev) => ({
            ...prev,
            hero_image: settings.hero_image || null
          }));
        }
      } catch (error) {
        console.error('Error reloading salon settings:', error);
      }
      
      // Reset file input
      if (heroFileInputRef.current) {
        heroFileInputRef.current.value = '';
      }
    } catch (error) {
      console.error(error);
      setHeroImageMessage({ type: 'error', text: 'Lỗi kết nối khi tải ảnh hero.' });
    } finally {
      setHeroImageUploading(false);
    }
  };

  const updateSalonSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/salon-settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          salon_phone: settingsForm.salon_phone,
          working_hours: settingsForm.working_hours
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setSettingsMessage({ type: 'error', text: EXPIRED_TOKEN_MESSAGE });
          return;
        }

        setSettingsMessage({ type: 'error', text: data?.message || 'Không thể cập nhật cài đặt salon.' });
        return;
      }

      setSettingsMessage({ type: 'success', text: data?.message || 'Đã cập nhật cài đặt salon.' });
    } catch (error) {
      console.error(error);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối khi cập nhật cài đặt salon.' });
    } finally {
      setSettingsSaving(false);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/services`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        console.error('Fetch services error:', res.status);
        setServices([]);
        return;
      }

      const data = await res.json();
      console.log('Services data:', data);
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data?.data && Array.isArray(data.data)) {
        list = data.data;
      }
      setServices(list);
    } catch (e) {
      console.error('Fetch services exception:', e);
      setServices([]);
    }
  };

  const fetchStaffs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/staffs`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        console.error('Fetch staffs error:', res.status);
        setStaffs([]);
        return;
      }

      const data = await res.json();
      console.log('Staffs data:', data);
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data?.data && Array.isArray(data.data)) {
        list = data.data;
      }
      setStaffs(list);

      if (list.length > 0) {
        const defaultStaffId = String(list[0].id);
        setNewAppointmentForm((prev) => ({
          ...prev,
          staff_id: prev.staff_id || defaultStaffId
        }));
      }
    } catch (e) {
      console.error('Fetch staffs exception:', e);
      setStaffs([]);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Fetch appointments error:', res.status, errorData);
        setAppointments([]);
        return;
      }
      
      const data = await res.json();
      console.log('Appointments data:', data);
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data?.data && Array.isArray(data.data)) {
        list = data.data;
      }
      setAppointments(list);
    } catch (e) {
      console.error('Fetch appointments exception:', e);
      setAppointments([]);
    }
  };

  const updateAppointmentStatus = async (id, statusAction) => {
    const actionLabelMap = {
      confirm: 'xác nhận lịch hẹn này',
      reject: 'từ chối lịch hẹn này'
    };

    const actionLabel = actionLabelMap[statusAction] || 'thay đổi trạng thái lịch hẹn này';
    if (!confirm(`Bạn có chắc chắn muốn ${actionLabel}?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments/${id}/${statusAction}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setAppointmentMessage({ type: 'success', text: `Đã ${statusAction === 'confirm' ? 'xác nhận' : 'từ chối'} lịch hẹn thành công.` });
        fetchAppointments();
      } else {
        const data = await res.json().catch(() => ({}));
        setAppointmentMessage({ type: 'error', text: data?.message || 'Có lỗi xảy ra khi cập nhật trạng thái.' });
      }
    } catch (e) {
      console.error(e);
      setAppointmentMessage({ type: 'error', text: 'Lỗi kết nối khi cập nhật trạng thái lịch hẹn.' });
    }
  };

  const createManualAppointment = async (e) => {
    e.preventDefault();
    setAppointmentMessage({ type: '', text: '' });

    if (!newAppointmentForm.name || !newAppointmentForm.phone || !newAppointmentForm.appointment_date || newAppointmentForm.service_ids.length === 0) {
      setAppointmentMessage({ type: 'error', text: 'Vui lòng nhập đủ tên, số điện thoại, ngày giờ và dịch vụ.' });
      return;
    }

    setIsSubmittingAppointment(true);

    try {
      const payload = {
        name: newAppointmentForm.name,
        phone: newAppointmentForm.phone,
        staff_id: 1, // Default staff
        appointment_date: `${newAppointmentForm.appointment_date} ${newAppointmentForm.appointment_time}:00`,
        services: newAppointmentForm.service_ids,
        notes: newAppointmentForm.notes || null
      };

      const res = await fetch(`${API_BASE_URL}/api/appointments/create-manual`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setAppointmentMessage({ type: 'error', text: data?.message || 'Không thể tạo lịch hẹn.' });
        return;
      }

      setAppointmentMessage({ type: 'success', text: data?.message || 'Tạo lịch hẹn thành công.' });
      setNewAppointmentForm((prev) => ({
        ...prev,
        name: '',
        phone: '',
        appointment_date: '',
        appointment_time: '09:00',
        service_ids: [],
        notes: ''
      }));
      fetchAppointments();
    } catch (e) {
      console.error(e);
      setAppointmentMessage({ type: 'error', text: 'Lỗi kết nối khi tạo lịch hẹn.' });
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  const startEditAppointment = (appointment) => {
    const dateParts = getLocalDateTimeParts(appointment.appointment_date);
    setEditingAppointmentId(appointment.id);
    setEditAppointmentForm({
      staff_id: '1',
      appointment_date: dateParts.date,
      appointment_time: dateParts.time,
      service_ids: (appointment.services || []).map((item) => Number(item.id)),
      status: appointment.status || 'pending',
      notes: appointment.notes || ''
    });
    setAppointmentMessage({ type: '', text: '' });
  };

  const submitEditAppointmentByAdmin = async (appointmentId) => {
    if (!editAppointmentForm.appointment_date || editAppointmentForm.service_ids.length === 0) {
      setAppointmentMessage({ type: 'error', text: 'Vui lòng nhập đủ ngày giờ và dịch vụ khi cập nhật.' });
      return;
    }

    try {
      const payload = {
        staff_id: 1, // Default staff
        appointment_date: `${editAppointmentForm.appointment_date} ${editAppointmentForm.appointment_time}:00`,
        services: editAppointmentForm.service_ids,
        status: editAppointmentForm.status,
        notes: editAppointmentForm.notes || null
      };

      const res = await fetch(`${API_BASE_URL}/api/appointments/${appointmentId}/admin`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setAppointmentMessage({ type: 'error', text: data?.message || 'Không thể cập nhật lịch hẹn.' });
        return;
      }

      setAppointmentMessage({ type: 'success', text: data?.message || 'Cập nhật lịch hẹn thành công.' });
      setEditingAppointmentId(null);
      fetchAppointments();
    } catch (e) {
      console.error(e);
      setAppointmentMessage({ type: 'error', text: 'Lỗi kết nối khi cập nhật lịch hẹn.' });
    }
  };

  const deleteAppointmentByAdmin = async (appointmentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch hẹn này?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments/${appointmentId}/admin`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAppointmentMessage({ type: 'error', text: data?.message || 'Không thể xóa lịch hẹn.' });
        return;
      }

      if (editingAppointmentId === appointmentId) {
        setEditingAppointmentId(null);
      }

      setAppointmentMessage({ type: 'success', text: data?.message || 'Xóa lịch hẹn thành công.' });
      fetchAppointments();
    } catch (e) {
      console.error(e);
      setAppointmentMessage({ type: 'error', text: 'Lỗi kết nối khi xóa lịch hẹn.' });
    }
  };

  const addService = async (e) => {
    e.preventDefault();
    setServiceFormMessage({ type: '', text: '' });

    try {
      const payload = new FormData();
      payload.append('name', formData.name);
      payload.append('description', formData.description);
      payload.append('price', formData.price);
      payload.append('duration', formData.duration);
      if (imageFile) {
        payload.append('image', imageFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/services`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: payload
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = `Không thể thêm dịch vụ (HTTP ${res.status}).`;

        try {
          const data = JSON.parse(raw);
          if (data?.errors) {
            const details = Object.values(data.errors).flat().join(' | ');
            message = details || data?.message || message;
          } else {
            message = data?.error ? `${data?.message || message}: ${data.error}` : (data?.message || message);
          }
        } catch {
          if (raw) {
            message = `${message} ${raw.slice(0, 120)}`;
          }
        }

        setServiceFormMessage({ type: 'error', text: message });
        return;
      }

      setFormData({ name: '', description: '', price: '', duration: '' });
      setImageFile(null);
      setUploadInputKey((k) => k + 1);
      setServiceFormMessage({ type: 'success', text: 'Thêm dịch vụ thành công.' });
      fetchServices();
    } catch (e) {
      console.error(e);
      setServiceFormMessage({ type: 'error', text: 'Lỗi kết nối. Vui lòng kiểm tra server và thử lại.' });
    }
  };

  const deleteService = async (id) => {
    if (!window.confirm('Xác nhận xóa?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/services/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setServiceFormMessage({ type: 'success', text: 'Đã xóa dịch vụ thành công.' });
        fetchServices();
      } else {
        const data = await res.json().catch(() => ({}));
        setServiceFormMessage({ type: 'error', text: data?.message || 'Lỗi khi xóa dịch vụ.' });
      }
    } catch (e) {
      console.error(e);
      setServiceFormMessage({ type: 'error', text: 'Lỗi kết nối khi xóa dịch vụ.' });
    }
  };

  const startEditService = (service) => {
    setEditingServiceId(service.id);
    setEditServiceForm({
      name: service.name || '',
      description: service.description || '',
      price: service.price || '',
      duration: service.duration || ''
    });
    setEditServiceImageFile(null);
  };

  const updateService = async (id) => {
    setServiceFormMessage({ type: '', text: '' });

    try {
      const payload = new FormData();
      payload.append('_method', 'PUT');
      payload.append('name', editServiceForm.name);
      payload.append('description', editServiceForm.description);
      payload.append('price', editServiceForm.price);
      payload.append('duration', editServiceForm.duration);
      if (editServiceImageFile) {
        payload.append('image', editServiceImageFile);
      }

      const res = await fetch(`${API_BASE_URL}/api/services/${id}`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: payload
      });

      if (!res.ok) {
        const raw = await res.text();
        let message = `Không thể cập nhật dịch vụ (HTTP ${res.status}).`;

        try {
          const data = JSON.parse(raw);
          if (data?.errors) {
            const details = Object.values(data.errors).flat().join(' | ');
            message = details || data?.message || message;
          } else {
            message = data?.error ? `${data?.message || message}: ${data.error}` : (data?.message || message);
          }
        } catch {
          if (raw) {
            message = `${message} ${raw.slice(0, 120)}`;
          }
        }

        setServiceFormMessage({ type: 'error', text: message });
        return;
      }

      setEditingServiceId(null);
      setEditServiceForm({ name: '', description: '', price: '', duration: '' });
      setEditServiceImageFile(null);
      setServiceFormMessage({ type: 'success', text: 'Cập nhật dịch vụ thành công.' });
      fetchServices();
    } catch (e) {
      console.error(e);
      setServiceFormMessage({ type: 'error', text: 'Lỗi kết nối. Vui lòng kiểm tra server và thử lại.' });
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders()
      });
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('adminAuth');
      setAuth(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#08050c] text-[#f8e7d9]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        <nav className="rounded-xl border border-[#7f5c44]/40 bg-[#140d1f]/95 px-4 py-3 shadow-xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d5a56a]">Luxury Nails Spa</p>
              <h1 className="text-2xl font-black text-[#f7dfc2]">Admin Dashboard</h1>
            </div>
            <button
              onClick={logout}
              className="rounded-md bg-[#f0c6bb] px-4 py-2 text-sm font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]"
            >
              Đăng xuất
            </button>
          </div>
        </nav>

        <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
          <aside className="rounded-xl border border-[#7f5c44]/40 bg-[#120b1c] p-3 md:min-h-[78vh]">
            <button
              onClick={() => setPage('dashboard')}
              className={`mb-2 w-full rounded-lg px-4 py-2 text-left font-semibold transition ${
                page === 'dashboard'
                  ? 'bg-[#2a1d2f] text-[#f7dfc2] border border-[#8d6a52]'
                  : 'text-[#d7c4c6] hover:bg-[#24182a]'
              }`}
            >
              Tổng quan
            </button>
            <button
              onClick={() => setPage('services')}
              className={`mb-2 w-full rounded-lg px-4 py-2 text-left font-semibold transition ${
                page === 'services'
                  ? 'bg-[#2a1d2f] text-[#f7dfc2] border border-[#8d6a52]'
                  : 'text-[#d7c4c6] hover:bg-[#24182a]'
              }`}
            >
              Dịch vụ
            </button>
            <button
              onClick={() => setPage('appointments')}
              className={`w-full rounded-lg px-4 py-2 text-left font-semibold transition ${
                page === 'appointments'
                  ? 'bg-[#2a1d2f] text-[#f7dfc2] border border-[#8d6a52]'
                  : 'text-[#d7c4c6] hover:bg-[#24182a]'
              }`}
            >
              Lịch hẹn
            </button>
            <button
              onClick={() => setPage('settings')}
              className={`mt-2 w-full rounded-lg px-4 py-2 text-left font-semibold transition ${
                page === 'settings'
                  ? 'bg-[#2a1d2f] text-[#f7dfc2] border border-[#8d6a52]'
                  : 'text-[#d7c4c6] hover:bg-[#24182a]'
              }`}
            >
              Cài đặt salon
            </button>
            <button
              onClick={() => setPage('users')}
              className={`mt-2 w-full rounded-lg px-4 py-2 text-left font-semibold transition ${
                page === 'users'
                  ? 'bg-[#2a1d2f] text-[#f7dfc2] border border-[#8d6a52]'
                  : 'text-[#d7c4c6] hover:bg-[#24182a]'
              }`}
            >
              Tài khoản
            </button>
          </aside>

          <main className="rounded-xl border border-[#7f5c44]/35 bg-[#0b0712] p-5 md:p-7">
            {page === 'dashboard' && (
              <div className="rounded-xl border border-[#8d6a52]/40 bg-[#170f22] p-6">
                <h2 className="text-3xl font-black text-[#f7dfc2]">Chào mừng Admin</h2>
                <p className="mt-2 text-[#cbb9bb]">Chọn tab bên trái để quản lý hệ thống theo phong cách luxury.</p>
              </div>
            )}

            {page === 'services' && (
              <div>
                <h2 className="mb-6 text-3xl font-black text-[#f7dfc2]">Quản lý dịch vụ</h2>

                <form onSubmit={addService} className="mb-8 rounded-xl border border-[#8d6a52]/35 bg-[#170f22] p-5">
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Tên dịch vụ"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="col-span-2 rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                    />
                    <textarea
                      placeholder="Mô tả"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="col-span-2 rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                    />
                    <input
                      type="number"
                      placeholder="Giá"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                    />
                    <input
                      type="number"
                      placeholder="Thời gian"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      min="1"
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                    />
                    <div className="col-span-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#d9c1ad]">
                        Tải ảnh dịch vụ
                      </label>
                      <input
                        key={uploadInputKey}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        className="w-full rounded-lg border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#f0c6bb] file:px-3 file:py-1 file:font-bold file:text-[#2a1724]"
                      />
                      {imageFile && <p className="mt-2 text-xs text-[#c7b4b6]">Đã chọn: {imageFile.name}</p>}
                    </div>
                  </div>
                  <button type="submit" className="rounded-md bg-[#f0c6bb] px-5 py-2 font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]">
                    Thêm dịch vụ
                  </button>
                  {serviceFormMessage.text && (
                    <p className={`mt-3 text-sm font-semibold ${serviceFormMessage.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {serviceFormMessage.text}
                    </p>
                  )}
                </form>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {services.map((service) => (
                    <div key={service.id} className="rounded-xl border border-[#8d6a52]/35 bg-[#170f22] p-5">
                      {resolveServiceImage(service) && (
                        <img
                          src={resolveServiceImage(service)}
                          alt={service.name}
                          className="mb-3 h-36 w-full rounded-lg object-cover"
                        />
                      )}
                      <h3 className="mb-2 text-xl font-black text-[#f7dfc2]">{service.name}</h3>
                      <p className="mb-2 text-sm text-[#c7b4b6]">{service.description}</p>
                      <p className="mb-4 text-sm font-semibold text-[#f3d5b8]">Giá: {service.price}đ | Thời gian: {service.duration} phút</p>
                      
                      <div className="flex gap-2 mb-4">
                        <button 
                          onClick={() => startEditService(service)} 
                          className="rounded-md bg-[#f0c6bb] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]"
                        >
                          Sửa
                        </button>
                        <button 
                          onClick={() => deleteService(service.id)} 
                          className="rounded-md border border-rose-400/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-rose-200 hover:bg-rose-500/20"
                        >
                          Xóa
                        </button>
                      </div>

                      {editingServiceId === service.id && (
                        <div className="mt-4 rounded-lg border border-[#6f5262] bg-[#0f0a17] p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#d8a56c]">Cập nhật dịch vụ</p>
                          
                          <input
                            type="text"
                            placeholder="Tên dịch vụ"
                            value={editServiceForm.name}
                            onChange={(e) => setEditServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="mb-2 w-full rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                          />
                          
                          <textarea
                            placeholder="Mô tả"
                            value={editServiceForm.description}
                            onChange={(e) => setEditServiceForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="mb-2 w-full rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                          />
                          
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <input
                              type="number"
                              placeholder="Giá"
                              value={editServiceForm.price}
                              onChange={(e) => setEditServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                              className="rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                            />
                            <input
                              type="number"
                              placeholder="Thời gian"
                              value={editServiceForm.duration}
                              onChange={(e) => setEditServiceForm((prev) => ({ ...prev, duration: e.target.value }))}
                              className="rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                            />
                          </div>

                          <div className="mb-2">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#d9c1ad]">Ảnh (nếu muốn cập nhật)</label>
                            <input
                              key={editServiceImageKey}
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              onChange={(e) => setEditServiceImageFile(e.target.files?.[0] || null)}
                              className="w-full rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-[#f0c6bb] file:px-3 file:py-1 file:font-bold file:text-[#2a1724]"
                            />
                            {editServiceImageFile && <p className="mt-1 text-xs text-[#c7b4b6]">Đã chọn: {editServiceImageFile.name}</p>}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => updateService(service.id)}
                              className="rounded-md bg-[#f0c6bb] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]"
                            >
                              Cập nhật
                            </button>
                            <button
                              onClick={() => setEditingServiceId(null)}
                              className="rounded-md border border-[#8d6a52] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#f3d5b8] hover:bg-[#2a1d2f]"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {page === 'appointments' && (
              <div>
                <h2 className="mb-6 text-3xl font-black text-[#f7dfc2]">Quản lý lịch hẹn</h2>

                <form onSubmit={createManualAppointment} className="mb-6 rounded-xl border border-[#8d6a52]/35 bg-[#170f22] p-5">
                  <h3 className="mb-3 text-lg font-black text-[#f7dfc2]">Thêm lịch hẹn mới</h3>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Tên khách hàng"
                      value={newAppointmentForm.name}
                      onChange={(e) => setNewAppointmentForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                    />
                    <input
                      type="text"
                      placeholder="Số điện thoại"
                      value={newAppointmentForm.phone}
                      onChange={(e) => setNewAppointmentForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                    />

                    <div className="relative" ref={newAptServicePickerRef}>
                      <button
                        type="button"
                        onClick={() => setIsNewAptServicePickerOpen((prev) => !prev)}
                        className="w-full rounded-md border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-left text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#d8a56c]">Chọn dịch vụ</p>
                        <p className="mt-1 text-xs text-[#cbb9bb]">
                          {newAppointmentForm.service_ids.length > 0
                            ? services.filter(s => newAppointmentForm.service_ids.includes(s.id)).map(s => s.name).join(', ')
                            : 'Chọn dịch vụ'}
                        </p>
                      </button>

                      {isNewAptServicePickerOpen && (
                        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-[#8d6a52] bg-[#1a0f27] p-3 shadow-xl">
                          <div className="max-h-48 space-y-2 overflow-auto pr-1">
                            {services.map((service) => {
                              const checked = newAppointmentForm.service_ids.includes(service.id);
                              return (
                                <label
                                  key={service.id}
                                  className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                                    checked
                                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                      : 'border-[#6f5262] bg-[#120b1c] text-[#f8e7d9] hover:border-[#8d6a52]'
                                  }`}
                                >
                                  <span>{service.name}</span>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleNewAppointmentService(service.id)}
                                    className="h-4 w-4 accent-[#f0c6bb]"
                                  />
                                </label>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsNewAptServicePickerOpen(false)}
                            className="mt-3 w-full rounded-md bg-[#f0c6bb] py-2 text-xs font-black uppercase text-[#2a1724]"
                          >
                            Xong
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowNewAptCalendar(!showNewAptCalendar)}
                          className="w-full rounded-md border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-left text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring"
                        >
                          📅 {formatDisplayDate(newAppointmentForm.appointment_date) || 'Chọn ngày'}
                        </button>
                        
                        {showNewAptCalendar && (
                          <div className="absolute z-50 mt-1 w-64 rounded-lg border border-[#8d6a52] bg-[#1a0f27] p-3 shadow-xl left-0">
                            <div className="mb-3 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => handleMonthChangeHelper(setNewAptCalendarMonth, newAptCalendarMonth, -1)}
                                className="rounded px-2 py-1 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                              >
                                ‹
                              </button>
                              <div className="text-center text-xs font-bold text-[#f7d9b2]">
                                {newAptCalendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleMonthChangeHelper(setNewAptCalendarMonth, newAptCalendarMonth, 1)}
                                className="rounded px-2 py-1 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                              >
                                ›
                              </button>
                            </div>

                            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#d8a56c]">
                              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                                <div key={day}>{day}</div>
                              ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                              {calculateCalendarDays(newAptCalendarMonth).map((date, i) => {
                                let dateStr = null;
                                if (date) {
                                  const year = date.getFullYear();
                                  const month = String(date.getMonth() + 1).padStart(2, '0');
                                  const day = String(date.getDate()).padStart(2, '0');
                                  dateStr = `${year}-${month}-${day}`;
                                }
                                const isSelected = dateStr === newAppointmentForm.appointment_date;
                                
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    disabled={!date}
                                    onClick={() => date && handleNewAptDateSelect(date)}
                                    className={`rounded px-1 py-1 text-[10px] font-semibold ${
                                      !date
                                        ? 'text-[#6f5262]'
                                        : isSelected
                                        ? 'bg-[#f7d9b2] text-[#2a1724]'
                                        : 'bg-[#2a1d2f] text-[#f7d9b2] hover:bg-[#3a2d3f]'
                                    }`}
                                  >
                                    {date?.getDate()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowNewAptTimeGrid(!showNewAptTimeGrid)}
                        className="w-full rounded-md border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-left text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring flex justify-between items-center"
                      >
                        <span>🕒 {newAppointmentForm.appointment_time || 'Giờ'}</span>
                        <span className="text-[10px]">{showNewAptTimeGrid ? '▲' : '▼'}</span>
                      </button>
                    </div>
                  </div>

                  {showNewAptTimeGrid && (
                    <div className="mt-3 rounded-lg border border-[#8d6a52]/30 bg-[#0f0a17] p-3">
                      <p className="mb-2 text-xs font-bold text-[#f7d9b2]">
                        Chọn khung giờ - {formatDisplayDate(newAppointmentForm.appointment_date) || 'Chưa chọn ngày'}
                      </p>
                      {loadingSchedule ? (
                        <p className="text-xs text-[#cbb9bb]">Đang tải...</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {getAvailableTimeSlots(newAppointmentForm.appointment_date).map((slot) => {
                            const isBooked = bookedSlots.includes(slot);
                            const isSelected = newAppointmentForm.appointment_time === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={isBooked}
                                onClick={() => {
                                  setNewAppointmentForm(prev => ({ ...prev, appointment_time: slot }));
                                  setShowNewAptTimeGrid(false);
                                }}
                                className={`rounded px-2 py-2 text-center text-xs font-bold transition ${
                                  isBooked
                                    ? 'cursor-not-allowed bg-rose-500/20 text-rose-300 opacity-50'
                                    : isSelected
                                    ? 'bg-[#f0c6bb] text-[#2a1724]'
                                    : 'bg-[#2a1d2f] text-[#f7d9b2] hover:bg-[#3a2d3f]'
                                }`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <textarea
                    value={newAppointmentForm.notes}
                    onChange={(e) => setNewAppointmentForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Ghi chú (không bắt buộc)"
                    className="mt-3 w-full rounded-lg border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                  />

                  <button
                    type="submit"
                    disabled={isSubmittingAppointment}
                    className="mt-3 rounded-md bg-[#f0c6bb] px-5 py-2 font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf] disabled:opacity-60"
                  >
                    {isSubmittingAppointment ? 'Đang thêm...' : 'Thêm lịch hẹn'}
                  </button>

                  {appointmentMessage.text && (
                    <p className={`mt-3 text-sm font-semibold ${appointmentMessage.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {appointmentMessage.text}
                    </p>
                  )}
                </form>

                <div className="space-y-4">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="rounded-xl border border-[#8d6a52]/35 bg-[#170f22] p-5">
                      <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-[#f7dfc2]">{apt.user?.name || apt.customer_name || apt.name || 'N/A'}</p>
                        <p className="text-sm text-[#f3d5b8] mb-1">{apt.user?.phone}</p>
                        <p className="text-sm text-[#c7b4b6] mb-1">
                          Dịch vụ: {apt.services?.map(s => s.name).join(', ') || 'N/A'}
                        </p>
                        <p className="text-xs text-[#c7b4b6] opacity-70">{new Date(apt.appointment_date).toLocaleString('vi-VN')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg border border-[#8d6a52] bg-[#26192d] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#f3d5b8]">
                          {apt.status}
                        </span>

                        <button
                          onClick={() => startEditAppointment(apt)}
                          className="rounded-lg border border-[#8d6a52] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#f3d5b8] hover:bg-[#2a1d2f]"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => deleteAppointmentByAdmin(apt.id)}
                          className="rounded-lg border border-rose-400/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-rose-200 hover:bg-rose-500/20"
                        >
                          Xóa
                        </button>
                      </div>
                      </div>

                      {editingAppointmentId === apt.id && (
                        <div className="mt-4 rounded-lg border border-[#6f5262] bg-[#0f0a17] p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#d8a56c]">Cập nhật thông tin lịch hẹn</p>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                            <select
                              value={editAppointmentForm.status}
                              onChange={(e) => setEditAppointmentForm((prev) => ({ ...prev, status: e.target.value }))}
                              className="rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                            >
                              {['pending', 'confirmed', 'rejected', 'in-process', 'completed', 'cancelled', 'no-show'].map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>

                            <div className="relative" ref={editAptServicePickerRef}>
                              <button
                                type="button"
                                onClick={() => setIsEditAptServicePickerOpen((prev) => !prev)}
                                className="w-full rounded-md border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-left text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring"
                              >
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#d8a56c]">Dịch vụ</p>
                                <p className="mt-1 text-xs text-[#cbb9bb]">
                                  {editAppointmentForm.service_ids.length > 0
                                    ? services.filter(s => editAppointmentForm.service_ids.includes(s.id)).map(s => s.name).join(', ')
                                    : 'Chọn dịch vụ'}
                                </p>
                              </button>

                              {isEditAptServicePickerOpen && (
                                <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-[#8d6a52] bg-[#1a0f27] p-3 shadow-xl">
                                  <div className="max-h-48 space-y-2 overflow-auto pr-1">
                                    {services.map((service) => {
                                      const checked = editAppointmentForm.service_ids.includes(service.id);
                                      return (
                                        <label
                                          key={service.id}
                                          className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                                            checked
                                              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                              : 'border-[#6f5262] bg-[#120b1c] text-[#f8e7d9] hover:border-[#8d6a52]'
                                          }`}
                                        >
                                          <span>{service.name}</span>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleEditAppointmentService(service.id)}
                                            className="h-4 w-4 accent-[#f0c6bb]"
                                          />
                                        </label>
                                      );
                                    })}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setIsEditAptServicePickerOpen(false)}
                                    className="mt-3 w-full rounded-md bg-[#f0c6bb] py-2 text-xs font-black uppercase text-[#2a1724]"
                                  >
                                    Xong
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setShowEditAptCalendar(!showEditAptCalendar)}
                                  className="w-full rounded-md border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-left text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring"
                                >
                                  📅 {formatDisplayDate(editAppointmentForm.appointment_date) || 'Chọn ngày'}
                                </button>
                                
                                {showEditAptCalendar && (
                                  <div className="absolute z-50 mt-1 w-64 rounded-lg border border-[#8d6a52] bg-[#1a0f27] p-3 shadow-xl left-0">
                                    <div className="mb-3 flex items-center justify-between">
                                      <button
                                        type="button"
                                        onClick={() => handleMonthChangeHelper(setEditAptCalendarMonth, editAptCalendarMonth, -1)}
                                        className="rounded px-2 py-1 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                                      >
                                        ‹
                                      </button>
                                      <div className="text-center text-xs font-bold text-[#f7d9b2]">
                                        {editAptCalendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleMonthChangeHelper(setEditAptCalendarMonth, editAptCalendarMonth, 1)}
                                        className="rounded px-2 py-1 text-[#f7d9b2] hover:bg-[#2a1d2f]"
                                      >
                                        ›
                                      </button>
                                    </div>

                                    <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#d8a56c]">
                                      {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                                        <div key={day}>{day}</div>
                                      ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-1">
                                      {calculateCalendarDays(editAptCalendarMonth).map((date, i) => {
                                        let dateStr = null;
                                        if (date) {
                                          const year = date.getFullYear();
                                          const month = String(date.getMonth() + 1).padStart(2, '0');
                                          const day = String(date.getDate()).padStart(2, '0');
                                          dateStr = `${year}-${month}-${day}`;
                                        }
                                        const isSelected = dateStr === editAppointmentForm.appointment_date;
                                        
                                        return (
                                          <button
                                            key={i}
                                            type="button"
                                            disabled={!date}
                                            onClick={() => date && handleEditAptDateSelect(date)}
                                            className={`rounded px-1 py-1 text-[10px] font-semibold ${
                                              !date
                                                ? 'text-[#6f5262]'
                                                : isSelected
                                                ? 'bg-[#f7d9b2] text-[#2a1724]'
                                                : 'bg-[#2a1d2f] text-[#f7d9b2] hover:bg-[#3a2d3f]'
                                            }`}
                                          >
                                            {date?.getDate()}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => setShowEditAptTimeGrid(!showEditAptTimeGrid)}
                                className="w-full rounded-md border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-left text-sm text-white outline-none ring-[#d8a56c] hover:border-[#d8a56c] focus:ring flex justify-between items-center"
                              >
                                <span>🕒 {editAppointmentForm.appointment_time || 'Giờ'}</span>
                                <span className="text-[10px]">{showEditAptTimeGrid ? '▲' : '▼'}</span>
                              </button>
                            </div>
                          </div>

                          {showEditAptTimeGrid && (
                            <div className="mt-3 rounded-lg border border-[#8d6a52]/30 bg-[#120b1c] p-3">
                              <p className="mb-2 text-xs font-bold text-[#f7d9b2]">
                                Chọn khung giờ - {formatDisplayDate(editAppointmentForm.appointment_date) || 'Chưa chọn ngày'}
                              </p>
                              {loadingSchedule ? (
                                <p className="text-xs text-[#cbb9bb]">Đang tải...</p>
                              ) : (
                                <div className="grid grid-cols-3 gap-2">
                                  {getAvailableTimeSlots(editAppointmentForm.appointment_date).map((slot) => {
                                    const isBooked = bookedSlots.includes(slot);
                                    const isSelected = editAppointmentForm.appointment_time === slot;
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        disabled={isBooked}
                                        onClick={() => {
                                          setEditAppointmentForm(prev => ({ ...prev, appointment_time: slot }));
                                          setShowEditAptTimeGrid(false);
                                        }}
                                        className={`rounded px-2 py-2 text-center text-xs font-bold transition ${
                                          isBooked
                                            ? 'cursor-not-allowed bg-rose-500/20 text-rose-300 opacity-50'
                                            : isSelected
                                            ? 'bg-[#f0c6bb] text-[#2a1724]'
                                            : 'bg-[#2a1d2f] text-[#f7d9b2] hover:bg-[#3a2d3f]'
                                        }`}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-3">
                            <textarea
                              value={editAppointmentForm.notes}
                              onChange={(e) => setEditAppointmentForm((prev) => ({ ...prev, notes: e.target.value }))}
                              placeholder="Ghi chú"
                              className="w-full rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                            />
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => submitEditAppointmentByAdmin(apt.id)}
                              className="rounded-md bg-[#f0c6bb] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]"
                            >
                              Cập nhật
                            </button>
                            <button
                              onClick={() => setEditingAppointmentId(null)}
                              className="rounded-md border border-[#8d6a52] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#f3d5b8] hover:bg-[#2a1d2f]"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {page === 'settings' && (
              <div>
                <h2 className="mb-6 text-3xl font-black text-[#f7dfc2]">Cài đặt salon</h2>

                {settingsLoading ? (
                  <p className="text-[#cbb9bb]">Đang tải cài đặt...</p>
                ) : (
                  <>
                    {/* Hero Image Upload Section */}
                    <div className="mb-6 rounded-xl border border-[#8d6a52]/35 bg-[#170f22] p-5">
                      <h3 className="mb-4 text-lg font-black text-[#f7dfc2]">Tải lên ảnh Hero</h3>
                      
                      {salonSettings.hero_image?.url && (
                        <div className="mb-4">
                          <p className="mb-2 text-sm text-[#d7c4c6]">Ảnh hiện tại:</p>
                          <img
                            src={resolveHeroImage(salonSettings.hero_image.url)}
                            alt="Current Hero"
                            className="max-h-40 max-w-xs rounded-lg object-cover"
                          />
                        </div>
                      )}

                      <div className="w-full rounded-lg border border-dashed border-[#8d6a52]/40 bg-[#0f0a17] px-4 py-2 text-[#cbb9bb]">
                        <input
                          ref={heroFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/jpg,image/gif"
                          onChange={uploadHeroImage}
                          disabled={heroImageUploading}
                          className="hidden"
                          id="hero-image-input"
                        />
                        <label
                          htmlFor="hero-image-input"
                          className={`mr-4 inline-block rounded-md bg-[#d8a56c] px-3 py-2 font-semibold text-[#2a1724] ${heroImageUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        >
                          Chọn tệp
                        </label>
                        <span className="text-[#cbb9bb]">{heroSelectedFileName}</span>
                      </div>
                      
                      <p className="mt-2 text-xs text-[#99878e]">
                        Chấp nhận: JPEG, PNG, GIF (Tối đa 5MB)
                      </p>

                      {heroImageMessage.text && (
                        <p className={`mt-3 text-sm font-semibold ${heroImageMessage.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {heroImageMessage.text}
                        </p>
                      )}

                      {heroImageUploading && (
                        <p className="mt-3 text-sm text-[#d8a56c]">Đang tải lên...</p>
                      )}
                    </div>

                    {/* Settings Form */}
                    <form onSubmit={updateSalonSettings} className="rounded-xl border border-[#8d6a52]/35 bg-[#170f22] p-5">
                    <div className="mb-6">
                      <label className="mb-2 block text-sm font-semibold text-[#f3d5b8]">Số điện thoại liên hệ</label>
                      <input
                        type="text"
                        value={settingsForm.salon_phone}
                        onChange={(e) => setSettingsForm((prev) => ({ ...prev, salon_phone: e.target.value }))}
                        placeholder="Nhập số điện thoại liên hệ"
                        className="w-full rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                      />
                    </div>

                    <h3 className="mb-3 text-lg font-black text-[#f7dfc2]">Giờ làm việc theo ngày</h3>
                    <div className="space-y-3">
                      {Object.keys(DAY_LABELS).map((dayKey) => {
                        const value = settingsForm.working_hours?.[dayKey] || {};
                        return (
                          <div key={dayKey} className="rounded-lg border border-[#8d6a52]/30 bg-[#120b1c] p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="font-semibold text-[#f3d5b8]">{DAY_LABELS[dayKey]}</p>
                              <label className="flex items-center gap-2 text-xs text-[#d7c4c6]">
                                <input
                                  type="checkbox"
                                  checked={Boolean(value.closed)}
                                  onChange={(e) => updateWorkingHourValue(dayKey, 'closed', e.target.checked)}
                                />
                                Nghỉ
                              </label>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="time"
                                value={value.open || '09:00'}
                                disabled={Boolean(value.closed)}
                                onChange={(e) => updateWorkingHourValue(dayKey, 'open', e.target.value)}
                                className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-white outline-none ring-[#d8a56c] disabled:opacity-50"
                              />
                              <input
                                type="time"
                                value={value.close || '18:00'}
                                disabled={Boolean(value.closed)}
                                onChange={(e) => updateWorkingHourValue(dayKey, 'close', e.target.value)}
                                className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-3 py-2 text-white outline-none ring-[#d8a56c] disabled:opacity-50"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="mt-5 rounded-md bg-[#f0c6bb] px-5 py-2 font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf] disabled:opacity-60"
                    >
                      {settingsSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
                    </button>

                    {settingsMessage.text && (
                      <p className={`mt-3 text-sm font-semibold ${settingsMessage.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {settingsMessage.text}
                      </p>
                    )}
                  </form>
                  </>
                )}
              </div>
            )}

            {page === 'users' && (
              <div>
                <h2 className="mb-6 text-3xl font-black text-[#f7dfc2]">Quản lý người dùng</h2>

                <form onSubmit={addUser} className="mb-8 rounded-xl border border-[#8d6a52]/35 bg-[#170f22] p-5">
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Họ tên"
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                    />
                    <input
                      type="text"
                      placeholder="Tên đăng nhập"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                    />
                    <input
                      type="text"
                      placeholder="Số điện thoại"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring"
                    />
                    <div className="relative">
                      <input
                        type={showUserPassword ? 'text' : 'password'}
                        placeholder="Mật khẩu"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] placeholder:text-[#99878e] focus:ring pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowUserPassword(!showUserPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#99878e] hover:text-[#f0c6bb]"
                        title={showUserPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showUserPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="rounded-lg border border-[#6f5262] bg-[#0f0a17] px-4 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                    >
                      <option value="customer">Khách hàng</option>
                      <option value="admin">Quản trị viên</option>
                    </select>
                  </div>
                  <button type="submit" className="rounded-md bg-[#f0c6bb] px-5 py-2 font-black uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]">
                    Thêm người dùng
                  </button>
                  {userMessage.text && (
                    <p className={`mt-3 text-sm font-semibold ${userMessage.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {userMessage.text}
                    </p>
                  )}
                </form>

                <div className="grid grid-cols-1 gap-4">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-xl border border-[#8d6a52]/35 bg-[#170f22] p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-black text-[#f7dfc2]">{user.name}</h3>
                          <p className="text-sm text-[#c7b4b6]">@{user.username} | {user.email} | {user.phone || 'N/A'}</p>
                          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#d8a56c]">Vai trò: {user.role}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditUser(user)}
                            className="rounded-md bg-[#f0c6bb] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="rounded-md border border-rose-400/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-rose-200 hover:bg-rose-500/20"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>

                      {editingUserId === user.id && (
                        <div className="mt-4 rounded-lg border border-[#6f5262] bg-[#0f0a17] p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#d8a56c]">Cập nhật thông tin</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editUserForm.name}
                              onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                              className="rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                              placeholder="Họ tên"
                            />
                            <input
                              type="text"
                              value={editUserForm.username}
                              onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                              className="rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                              placeholder="Tên đăng nhập"
                            />
                            <input
                              type="email"
                              value={editUserForm.email}
                              onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                              className="rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                              placeholder="Email"
                            />
                            <input
                              type="text"
                              value={editUserForm.phone}
                              onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                              className="rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                              placeholder="Số điện thoại"
                            />
                            <div className="relative">
                              <input
                                type={showEditUserPassword ? 'text' : 'password'}
                                value={editUserForm.password}
                                onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                                className="w-full rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring pr-10"
                                placeholder="Mật khẩu mới (bỏ trống nếu không đổi)"
                              />
                              <button
                                type="button"
                                onClick={() => setShowEditUserPassword(!showEditUserPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#99878e] hover:text-[#f0c6bb]"
                                title={showEditUserPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                              >
                                {showEditUserPassword ? '👁️' : '👁️‍🗨️'}
                              </button>
                            </div>
                            <select
                              value={editUserForm.role}
                              onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                              className="rounded-lg border border-[#6f5262] bg-[#120b1c] px-3 py-2 text-white outline-none ring-[#d8a56c] focus:ring"
                            >
                              <option value="customer">Khách hàng</option>
                              <option value="admin">Quản trị viên</option>
                            </select>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => updateUser(user.id)}
                              className="rounded-md bg-[#f0c6bb] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#2a1724] hover:bg-[#ffd9cf]"
                            >
                              Cập nhật
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="rounded-md border border-[#8d6a52] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#f3d5b8] hover:bg-[#2a1d2f]"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);

