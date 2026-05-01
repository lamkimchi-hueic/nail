import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:8000/api';

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  const heroInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE}/salon-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data.data || {});
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showMessage('error', 'Không thể tải cài đặt');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/salon-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          salon_name: settings.salon_name,
          salon_address: settings.salon_address,
          salon_phone: settings.salon_phone,
          salon_email: settings.salon_email,
        })
      });
      if (response.ok) {
        showMessage('success', 'Cập nhật thông tin thành công!');
      } else {
        showMessage('error', 'Lỗi khi cập nhật thông tin');
      }
    } catch (error) {
      showMessage('error', 'Lỗi kết nối server');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file, type) => {
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'Kích thước ảnh tối đa 5MB');
      return;
    }

    setUploading(prev => ({ ...prev, [type]: true }));
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);

    try {
      const response = await fetch(`${API_BASE}/salon-settings/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (type === 'gallery') {
          setSettings(prev => ({
            ...prev,
            gallery_images: [...(prev.gallery_images || []), data.data.url]
          }));
        } else {
          setSettings(prev => ({ ...prev, [type]: data.data.url }));
        }
        showMessage('success', 'Tải ảnh lên thành công!');
      } else {
        const errorData = await response.json();
        showMessage('error', errorData.message || 'Lỗi khi tải ảnh lên');
      }
    } catch (error) {
      showMessage('error', 'Lỗi kết nối server');
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleDeleteImage = async (url, type) => {
    if (!window.confirm('Bạn muốn xóa ảnh này?')) return;

    try {
      const response = await fetch(`${API_BASE}/salon-settings/delete-image`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url, type })
      });

      if (response.ok) {
        if (type === 'gallery') {
          setSettings(prev => ({
            ...prev,
            gallery_images: (prev.gallery_images || []).filter(img => img !== url)
          }));
        } else {
          setSettings(prev => {
            const updated = { ...prev };
            delete updated[type];
            return updated;
          });
        }
        showMessage('success', 'Xóa ảnh thành công!');
      }
    } catch (error) {
      showMessage('error', 'Lỗi khi xóa ảnh');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toast Message */}
      {message.text && (
        <div
          className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl text-white font-medium transition-all duration-300 ${
            message.type === 'success'
              ? 'bg-gradient-to-r from-green-500 to-emerald-600'
              : 'bg-gradient-to-r from-red-500 to-rose-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{message.type === 'success' ? '✅' : '❌'}</span>
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">⚙️ Cài đặt Salon</h2>
        <p className="text-gray-500 mt-1">Quản lý thông tin, hình ảnh và thiết lập salon</p>
      </div>

      {/* === SALON INFO === */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            📋 Thông tin liên hệ
          </h3>
        </div>
        <form onSubmit={handleSaveInfo} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Salon Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Tên Salon
              </label>
              <input
                type="text"
                value={settings.salon_name || ''}
                onChange={(e) => setSettings({ ...settings, salon_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition bg-gray-50 focus:bg-white"
                placeholder="Tên salon của bạn"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={settings.salon_email || ''}
                onChange={(e) => setSettings({ ...settings, salon_email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition bg-gray-50 focus:bg-white"
                placeholder="email@salon.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                📞 Số điện thoại
              </label>
              <input
                type="tel"
                value={settings.salon_phone || ''}
                onChange={(e) => setSettings({ ...settings, salon_phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition bg-gray-50 focus:bg-white"
                placeholder="0123 456 789"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                📍 Địa chỉ
              </label>
              <input
                type="text"
                value={settings.salon_address || ''}
                onChange={(e) => setSettings({ ...settings, salon_address: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition bg-gray-50 focus:bg-white"
                placeholder="123 Đường ABC, Quận XYZ"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-rose-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Đang lưu...
                </>
              ) : (
                <>💾 Lưu thông tin</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* === HERO IMAGE === */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            🖼️ Ảnh bìa (Hero Image)
          </h3>
        </div>
        <div className="p-6">
          {settings.hero_image ? (
            <div className="relative group">
              <img
                src={settings.hero_image}
                alt="Hero"
                className="w-full h-64 object-cover rounded-xl shadow-md"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl flex items-center justify-center gap-4">
                <button
                  onClick={() => heroInputRef.current?.click()}
                  className="bg-white text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
                >
                  🔄 Thay đổi
                </button>
                <button
                  onClick={() => handleDeleteImage(settings.hero_image, 'hero_image')}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition"
                >
                  🗑️ Xóa
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => heroInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-all duration-300 group"
            >
              {uploading.hero_image ? (
                <div className="animate-spin h-10 w-10 border-3 border-violet-500 border-t-transparent rounded-full"></div>
              ) : (
                <>
                  <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">📸</div>
                  <p className="text-gray-500 font-medium">Click để tải ảnh bìa lên</p>
                  <p className="text-gray-400 text-sm mt-1">JPG, PNG, GIF, WebP (tối đa 5MB)</p>
                </>
              )}
            </div>
          )}
          <input
            ref={heroInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e.target.files[0], 'hero_image')}
          />
        </div>
      </div>

      {/* === LOGO === */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            🏷️ Logo Salon
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-6">
            {settings.logo ? (
              <div className="relative group shrink-0">
                <img
                  src={settings.logo}
                  alt="Logo"
                  className="w-32 h-32 object-contain rounded-xl border-2 border-gray-100 shadow-md bg-white p-2"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl flex items-center justify-center gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="bg-white text-gray-800 px-2 py-1 rounded text-sm font-medium hover:bg-gray-100"
                  >
                    🔄
                  </button>
                  <button
                    onClick={() => handleDeleteImage(settings.logo, 'logo')}
                    className="bg-red-500 text-white px-2 py-1 rounded text-sm font-medium hover:bg-red-600"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => logoInputRef.current?.click()}
                className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 group shrink-0"
              >
                {uploading.logo ? (
                  <div className="animate-spin h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                ) : (
                  <>
                    <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">🏷️</div>
                    <p className="text-gray-400 text-xs text-center px-2">Tải logo</p>
                  </>
                )}
              </div>
            )}
            <div>
              <p className="text-gray-600 font-medium">Logo salon sẽ hiển thị trên trang web</p>
              <p className="text-gray-400 text-sm mt-1">Khuyến nghị: ảnh vuông, nền trong suốt (PNG)</p>
              <button
                onClick={() => logoInputRef.current?.click()}
                className="mt-3 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
              >
                📤 Chọn ảnh logo
              </button>
            </div>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e.target.files[0], 'logo')}
          />
        </div>
      </div>

      {/* === GALLERY === */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            🎨 Thư viện ảnh
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
            {(settings.gallery_images || []).map((img, idx) => (
              <div key={idx} className="relative group aspect-square">
                <img
                  src={img}
                  alt={`Gallery ${idx + 1}`}
                  className="w-full h-full object-cover rounded-xl shadow-md"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl flex items-center justify-center">
                  <button
                    onClick={() => handleDeleteImage(img, 'gallery')}
                    className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
                  >
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            ))}

            {/* Add new image button */}
            <div
              onClick={() => galleryInputRef.current?.click()}
              className="aspect-square border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all duration-300 group"
            >
              {uploading.gallery ? (
                <div className="animate-spin h-8 w-8 border-3 border-amber-500 border-t-transparent rounded-full"></div>
              ) : (
                <>
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">➕</div>
                  <p className="text-gray-400 text-sm text-center px-2">Thêm ảnh</p>
                </>
              )}
            </div>
          </div>
          <p className="text-gray-400 text-sm">
            Tải lên ảnh để hiển thị trong thư viện salon. JPG, PNG, GIF, WebP (tối đa 5MB/ảnh)
          </p>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleImageUpload(e.target.files[0], 'gallery')}
          />
        </div>
      </div>
    </div>
  );
}
