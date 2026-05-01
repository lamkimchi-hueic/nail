import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import AdminNavbar from '../components/AdminNavbar';
import AdminHome from '../components/AdminHome';
import AdminServices from '../components/AdminServices';
import AdminAppointments from '../components/AdminAppointments';
import AdminSettings from '../components/AdminSettings';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNavbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && <AdminHome />}
        {activeTab === 'services' && <AdminServices />}
        {activeTab === 'appointments' && <AdminAppointments />}
        {activeTab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
}
