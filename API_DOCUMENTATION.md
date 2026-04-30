# 📡 API Documentation - Nail Salon Booking System

Tài liệu chi tiết về tất cả API endpoints.

## 🔑 Base URL
```
http://localhost:8000/api
```

## 🔐 Authentication

Tất cả protected routes yêu cầu token trong header:
```
Authorization: Bearer {token}
```

---

## 👤 Authentication Endpoints

### 📝 Register
**POST** `/register`

**Request:**
```json
{
  "name": "John Doe",
  "email": "customer@example.com",
  "phone": "0123456789",
  "password": "password123",
  "password_confirmation": "password123",
  "role": "customer"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "customer@example.com",
      "role": "customer"
    },
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

### 🔓 Login
**POST** `/login`

**Request:**
```json
{
  "email": "admin@nail-salon.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "user": {
      "id": 1,
      "name": "Admin",
      "email": "admin@nail-salon.com",
      "role": "admin"
    },
    "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

### 👤 Get Current User
**GET** `/user` (Protected)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Admin",
    "email": "admin@nail-salon.com",
    "role": "admin"
  }
}
```

### 🚪 Logout
**POST** `/logout` (Protected)

**Response:**
```json
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

### 🔐 Google OAuth - Redirect
**GET** `/auth/google`

Chuyển hướng user đến Google OAuth login page.

**Usage:**
```html
<a href="http://localhost:8000/api/auth/google">
  Đăng nhập với Google
</a>
```

**Flow:**
1. User clicks link
2. Redirected to Google login
3. User authenticates with Google
4. Google redirects to `/auth/google/callback`
5. System creates/finds user and redirects to frontend with token

### 🔐 Google OAuth - Callback
**GET** `/auth/google/callback`

Google OAuth callback handler. Xử lý được tự động khi user hoàn thành Google authentication.

**Redirect Parameters:**
- `token`: Sanctum authentication token
- `error`: Error message nếu có lỗi (e.g., OAuth failed)

**Example redirect:**
```
http://localhost:5173?token=eyJ0eXAiOiJKV1QiLCJhbGc...
```

**User Creation:**
- Nếu user mới: Tạo với role `customer`, auto-generated username
- Nếu user tồn tại: Link OAuth account, cập nhật profile
- Tất cả OAuth users đều là `customer` role

---

## 💅 Services Endpoints

### 📋 Get All Services
**GET** `/services`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Nail Gel",
      "description": "Sơn gel chuyên nghiệp",
      "price": 150000,
      "duration": 60,
      "image": "https://example.com/image.jpg",
      "is_active": true,
      "created_at": "2026-04-14T10:00:00Z"
    }
  ]
}
```

### 🔍 Get Service Details
**GET** `/services/{id}`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Nail Gel",
    "description": "Sơn gel chuyên nghiệp",
    "price": 150000,
    "duration": 60,
    "image": "https://example.com/image.jpg",
    "is_active": true
  }
}
```

### ➕ Create Service (Admin)
**POST** `/services` (Protected)

**Request:**
```json
{
  "name": "Nail Art",
  "description": "Vẽ nail theo yêu cầu",
  "price": 200000,
  "duration": 90,
  "image": "https://example.com/image.jpg",
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dịch vụ được tạo thành công",
  "data": {
    "id": 2,
    "name": "Nail Art",
    "description": "Vẽ nail theo yêu cầu",
    "price": 200000,
    "duration": 90,
    "image": "https://example.com/image.jpg",
    "is_active": true
  }
}
```

### ✏️ Update Service (Admin)
**PUT** `/services/{id}` (Protected)

**Request:** (tất cả field là optional)
```json
{
  "name": "Updated Name",
  "price": 180000,
  "is_active": false
}
```

### 🗑️ Delete Service (Admin)
**DELETE** `/services/{id}` (Protected)

**Response:**
```json
{
  "success": true,
  "message": "Dịch vụ được xóa thành công"
}
```

---

## 📅 Appointments Endpoints

### 📋 Get All Appointments (Admin)
**GET** `/appointments` (Protected)

**Query Parameters:**
- `start_date` (yyyy-mm-dd)
- `end_date` (yyyy-mm-dd)
- `status` (pending|confirmed|in-process|completed|cancelled|no-show)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 5,
      "staff_id": 1,
      "appointment_date": "2026-04-20T14:00:00Z",
      "total_price": 350000,
      "status": "confirmed",
      "notes": "Mẫu nails tây ban nha",
      "user": {
        "id": 5,
        "name": "Khách hàng",
        "phone": "0123456789"
      },
      "staff": {
        "id": 1,
        "name": "Thương"
      },
      "services": [
        {
          "id": 1,
          "name": "Nail Gel",
          "price": 150000
        }
      ]
    }
  ]
}
```

### 📅 Get Appointments by Date Range (Admin)
**GET** `/appointments/date-range` (Protected)

**Query Parameters:**
- `start_date` (required, yyyy-mm-dd)
- `end_date` (required, yyyy-mm-dd)

**Response:** (tương tự như Get All Appointments)

### 🔍 Get Appointments by Phone (Public)
**GET** `/appointments/phone/{phone}`

**Response:** (tương tự như Get All Appointments)

### ➕ Book Appointment (Public)
**POST** `/appointments`

**Request:**
```json
{
  "name": "Nguyễn Văn A",
  "phone": "0987654321",
  "appointment_date": "2026-04-20 14:00:00",
  "staff_id": 1,
  "services": [1, 2],
  "notes": "Mẫu nail họa tiết hoa"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lịch hẹn được tạo thành công. Chúng tôi sẽ liên hệ xác nhận trong 24 giờ.",
  "data": {
    "id": 1,
    "user_id": 5,
    "staff_id": 1,
    "appointment_date": "2026-04-20T14:00:00Z",
    "total_price": 350000,
    "status": "pending",
    "notes": "Mẫu nail họa tiết hoa"
  }
}
```

### ✏️ Create Appointment Manually (Admin)
**POST** `/appointments/create-manual` (Protected)

**Request:**
```json
{
  "user_id": 5,
  "appointment_date": "2026-04-20 14:00:00",
  "staff_id": 1,
  "services": [1, 2],
  "notes": "Khách walk-in"
}
```
*Hoặc thay vì user_id:*
```json
{
  "phone": "0987654321",
  "name": "Khách mới",
  "appointment_date": "2026-04-20 14:00:00",
  "staff_id": 1,
  "services": [1, 2]
}
```

### ✅ Confirm Appointment (Admin)
**PATCH** `/appointments/{id}/confirm` (Protected)

**Response:**
```json
{
  "success": true,
  "message": "Lịch hẹn được xác nhận thành công",
  "data": { ... }
}
```

### ❌ Reject Appointment (Admin)
**PATCH** `/appointments/{id}/reject` (Protected)

### 🗓️ Reschedule Appointment (Admin)
**PATCH** `/appointments/{id}/reschedule` (Protected)

**Request:**
```json
{
  "appointment_date": "2026-04-21 10:00:00"
}
```

### 🔄 Update Status (Admin)
**PATCH** `/appointments/{id}/status` (Protected)

**Request:**
```json
{
  "status": "in-process"
}
```

**Valid statuses:** pending, confirmed, in-process, completed, cancelled, rejected, no-show

### 📱 Get My Appointments (Authenticated)
**GET** `/my-appointments` (Protected)

---

## 👥 Customers Endpoints (Admin)

### 📋 Get All Customers
**GET** `/customers` (Protected)

**Query Parameters:**
- `page` (default: 1)
- `per_page` (default: 15)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "name": "Khách hàng",
      "email": "customer@example.com",
      "phone": "0123456789",
      "role": "customer"
    }
  ],
  "pagination": {
    "total": 100,
    "per_page": 15,
    "current_page": 1,
    "last_page": 7
  }
}
```

### 🔍 Get Customer Details
**GET** `/customers/{id}` (Protected)

**Response:**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": 5,
      "name": "Khách hàng",
      "email": "customer@example.com",
      "phone": "0123456789"
    },
    "appointments": [ ... ],
    "total_appointments": 15,
    "total_spent": 2250000
  }
}
```

### 🔎 Search Customers
**GET** `/customers/search/{query}` (Protected)

**Parameter:** query (tối thiểu 2 ký tự)

Tìm kiếm theo: tên, SĐT, email

---

## ⚙️ Salon Settings Endpoints

### 📖 Get Public Settings
**GET** `/salon-settings`

**Response:**
```json
{
  "success": true,
  "data": {
    "salon_name": "My Nail Salon",
    "salon_address": "123 Main St",
    "salon_phone": "0123456789",
    "working_hours": {
      "monday": { "open": "08:00", "close": "18:00", "closed": false }
    },
    "slot_duration": 60,
    "max_concurrent_staff": 5
  }
}
```

### ⚙️ Get All Settings (Admin)
**GET** `/salon-settings` (Protected)

**Response:**
```json
{
  "success": true,
  "data": {
    "salon_name": "My Nail Salon",
    "salon_address": "123 Main St",
    "salon_phone": "0123456789",
    "salon_email": "info@nail-salon.com",
    "working_hours": { ... },
    "holidays": ["2026-04-30", "2026-05-01"],
    "slot_duration": 60,
    "max_concurrent_staff": 5,
    "booking_advance_days": 30,
    "cancel_before_hours": 0
  }
}
```

### ✏️ Update Settings (Admin)
**PUT** `/salon-settings` (Protected)

**Request:**
```json
{
  "salon_name": "Updated Name",
  "slot_duration": 45,
  "working_hours": {
    "monday": { "open": "08:00", "close": "18:00", "closed": false },
    "sunday": { "open": "00:00", "close": "00:00", "closed": true }
  }
}
```

---

## ⚠️ Error Responses

### Validation Error
```json
{
  "success": false,
  "message": "Dữ liệu không hợp lệ",
  "errors": {
    "email": ["Email đã được đăng ký"],
    "phone": ["Số điện thoại không hợp lệ"]
  }
}
```

### Unauthorized
```json
{
  "success": false,
  "message": "Email hoặc mật khẩu không chính xác"
}
```

### Forbidden
```json
{
  "success": false,
  "message": "Bạn không có quyền thực hiện hành động này"
}
```

### Not Found
```json
{
  "success": false,
  "message": "Dịch vụ không tìm thấy"
}
```

### Server Error
```json
{
  "success": false,
  "message": "Lỗi khi xử lý yêu cầu",
  "error": "Error details..."
}
```

---

## 📊 Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Server Error

---

## 🔑 Common Errors

| Error | Nguyên nhân | Giải pháp |
|-------|-----------|---------|
| Token not found | Không gửi token | Thêm Authorization header |
| Invalid credentials | Email/password sai | Kiểm tra lại credentials |
| Validation failed | Dữ liệu không đúng | Kiểm tra request schema |
| Cannot cancel appointment | Không có quyền hủy lịch | Kiểm tra số điện thoại/tài khoản đúng lịch hẹn |
| Appointment not found | ID không tồn tại | Kiểm tra appointment ID |

---

## 💡 Tips

✅ Luôn kiểm tra response status trước khi xử lý data  
✅ Lưu token trong localStorage sau khi login  
✅ Gửi token khi call API (tất cả protected routes)  
✅ Format datetime là ISO 8601: `2026-04-20T14:00:00Z`

