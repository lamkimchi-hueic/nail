# 💅 Nail Salon Booking System

Một hệ thống đặt lịch và quản lý salon tóc/móng chuyên nghiệp được xây dựng bằng **Laravel** (Backend) và **React** (Frontend).

## 🎯 Tính Năng

### 👤 Dành cho Khách Hàng
- ✅ Xem thông tin quán (tên, địa chỉ, giờ mở cửa, SĐT)
- ✅ Duyệt danh sách dịch vụ (tên, giá, thời gian, hình ảnh)
- ✅ Đặt lịch hẹn (chọn dịch vụ, ngày giờ, nhập thông tin)
- ✅ Tra cứu lịch hẹn (theo SĐT)
- ✅ Nhận thông báo xác nhận

### 🔧 Dành cho Admin (Chủ quán/Thợ)
- ✅ Quản lý dịch vụ (thêm/sửa/xóa)
- ✅ Quản lý lịch hẹn (xem, xác nhận, từ chối, dời giờ)
- ✅ Quản lý khách hàng (xem danh sách, tìm kiếm, lịch sử)
- ✅ Cài đặt quán (giờ làm, ngày nghỉ, slot time, số thợ)
- ✅ Thống kê lịch hẹn

## 🛠️ Công Nghệ Sử Dụng

**Backend:**
- Laravel 11
- PHP 8.2+
- MySQL 8.0
- Sanctum (API Authentication)

**Frontend:**
- React 18
- Axios (HTTP Client)
- Tailwind CSS

## 📋 Yêu Cầu Hệ Thống

- PHP >= 8.2
- Composer
- Node.js >= 16
- npm hoặc yarn
- MySQL 8.0+

## 🚀 Cài Đặt

### 1. Clone Repository & Cài Đặt Backend

```bash
# Tải dependencies Laravel
composer install

# Copy file config
cp .env.example .env

# Tạo APP_KEY
php artisan key:generate

# Set up database trong .env
# DB_DATABASE=nail_salon
# DB_USERNAME=root
# DB_PASSWORD=

# Chạy migration
php artisan migrate

# Seed data (optional)
php artisan db:seed
```

### 2. Cài Đặt Frontend

```bash
cd resources/react

# Cài dependencies
npm install

# Copy file .env
cp .env.example .env

# Chạy development server
npm start
```

## 📡 API Endpoints

### Authentication
```
POST   /api/register              - Đăng ký
POST   /api/login                 - Đăng nhập
POST   /api/logout                - Đăng xuất (authenticated)
GET    /api/user                  - Lấy thông tin user (authenticated)
```

### Services
```
GET    /api/services              - Danh sách dịch vụ
GET    /api/services/{id}         - Chi tiết dịch vụ
POST   /api/services              - Tạo dịch vụ (admin)
PUT    /api/services/{id}         - Cập nhật dịch vụ (admin)
DELETE /api/services/{id}         - Xóa dịch vụ (admin)
```

### Appointments
```
GET    /api/appointments                    - Danh sách lịch hẹn (admin)
GET    /api/appointments/date-range         - Lịch hẹn theo khoảng ngày
GET    /api/appointments/phone/{phone}      - Lịch hẹn theo SĐT
GET    /api/my-appointments                 - Lịch hẹn của khách (authenticated)
POST   /api/appointments                    - Tạo lịch hẹn mới
POST   /api/appointments/create-manual      - Tạo lịch hẹn thủ công (admin)
PATCH  /api/appointments/{id}/confirm       - Xác nhận lịch hẹn (admin)
PATCH  /api/appointments/{id}/reject        - Từ chối lịch hẹn (admin)
PATCH  /api/appointments/{id}/reschedule    - Dời lịch hẹn (admin)
PATCH  /api/appointments/{id}/status        - Cập nhật trạng thái (admin)
```

### Customers
```
GET    /api/customers              - Danh sách khách hàng (admin)
GET    /api/customers/{id}         - Chi tiết khách hàng (admin)
GET    /api/customers/search/{q}   - Tìm kiếm khách hàng (admin)
```

### Salon Settings
```
GET    /api/salon-settings         - Cài đặt công khai
GET    /api/salon-settings         - Tất cả cài đặt (admin)
PUT    /api/salon-settings         - Cập nhật cài đặt (admin)
```

## 📊 Trạng Thái Lịch Hẹn

- `pending` - Chờ xác nhận
- `confirmed` - Đã xác nhận
- `in-process` - Đang thực hiện
- `completed` - Hoàn thành
- `cancelled` - Đã hủy
- `rejected` - Từ chối
- `no-show` - Không tới

## 🔐 Authentication

Hệ thống sử dụng **Laravel Sanctum** cho API authentication. 

### Flow:
1. Người dùng đăng nhập/đăng ký
2. Nhận token
3. Gửi token trong header: `Authorization: Bearer {token}`

## 📁 Cấu Trúc Thư Mục

```
nail-booking-system/
├── app/Http/Controllers/
│   ├── AuthController.php
│   ├── ServiceController.php
│   ├── AppointmentController.php
│   ├── CustomerController.php
│   └── SalonSettingController.php
├── app/Models/
│   ├── User.php
│   ├── Service.php
│   ├── Appointment.php
│   ├── AppointmentDetail.php
│   ├── Staff.php
│   └── ...
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   ├── api.php
│   └── web.php
└── resources/react/
    ├── src/
    │   ├── components/
    │   │   ├── CustomerHome.js
    │   │   ├── BookingForm.js
    │   │   ├── AppointmentLookup.js
    │   │   ├── AdminAppointments.js
    │   │   ├── AdminServices.js
    │   │   ├── AdminCustomers.js
    │   │   └── AdminSettings.js
    │   ├── services/
    │   │   └── api.js
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── App.js
    │   └── index.js
    ├── public/
    └── package.json
```

## 🔐 Tài Khoản Demo

```
Email: admin@nail-salon.com
Password: password
Role: admin
```

## 📝 API Response Format

Tất cả responses trả về JSON format:

```json
{
  "success": true,
  "message": "Mô tả hoạt động",
  "data": {}
}
```

Lỗi:
```json
{
  "success": false,
  "message": "Mô tả lỗi",
  "error": "Chi tiết lỗi (nếu có)"
}
```

## 🚦 Chạy Hệ Thống

### Terminal 1 - Laravel Backend
```bash
php artisan serve
# Chạy trên http://localhost:8000
```

### Terminal 2 - React Frontend
```bash
cd resources/react
npm start
# Chạy trên http://localhost:3000
```

## 📝 Model Relationships

```
User (Khách hàng)
  └─ Appointments (1-N)
      ├─ Staff (N-1)
      └─ Services (N-N through AppointmentDetail)

Service
  └─ Appointments (N-N through AppointmentDetail)

Staff
  └─ Appointments (1-N)

Appointment
  ├─ User (N-1)
  ├─ Staff (N-1)
  └─ AppointmentDetails (1-N)

AppointmentDetail
  ├─ Appointment (N-1)
  └─ Service (N-1)
```

## 🛡️ Security Features

- ✅ CSRF Protection
- ✅ Token-based Authentication (Sanctum)
- ✅ Password Hashing (bcrypt)
- ✅ Rate Limiting (API)
- ✅ Authorization Middleware

## 🎨 UI/UX

- Responsive Design (Mobile-friendly)
- Tailwind CSS Styling
- Intuitive Navigation
- Real-time Updates

## 🔄 Quy Trình Đặt Lịch

1. Khách hàng xem dịch vụ
2. Chọn dịch vụ & chọn ngày giờ
3. Nhập thông tin cá nhân
4. Xác nhận đặt lịch
5. Admin nhận thông báo & xác nhận
6. Khách nhận xác nhận

## 📞 Support

Để hỗ trợ, vui lòng liên hệ qua email: support@nail-salon.com

## 📄 License

MIT License - xem file LICENSE để chi tiết.

---

**Phiên bản:** 1.0.0  
**Cập nhật lần cuối:** Tháng 4 năm 2026
