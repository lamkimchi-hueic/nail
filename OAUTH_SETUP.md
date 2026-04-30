# OAuth Setup Guide - Google OAuth Integration

## Overview
System này hiện đã được cấu hình để hỗ trợ Google OAuth authentication. Người dùng có thể đăng nhập bằng Google account hoặc username/password truyền thống.

## Cấu hình Google OAuth

### Bước 1: Tạo Google OAuth Credentials

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo một project mới hoặc sử dụng project hiện tại
3. Vào **APIs & Services** > **Credentials**
4. Nhấn **Create Credentials** > **OAuth Client ID**
5. Chọn **Web application**
6. Thêm authorized redirect URIs:
   - `http://127.0.0.1:8000/auth/google/callback` (Development)
   - `http://localhost:8000/auth/google/callback`
   - `https://yourdomain.com/auth/google/callback` (Production)

### Bước 2: Cấu hình .env

Thêm Google credentials vào `.env` file:

```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/auth/google/callback
FRONTEND_URL=http://127.0.0.1:5173
```

### Bước 3: Xác nhận cấu hình

Kiểm tra file `config/services.php` - Google configuration đã được thêm:

```php
'google' => [
    'client_id' => env('GOOGLE_CLIENT_ID'),
    'client_secret' => env('GOOGLE_CLIENT_SECRET'),
    'redirect' => env('GOOGLE_REDIRECT_URI', env('APP_URL') . '/auth/google/callback'),
],
```

## OAuth Flow

### Backend Flow
1. User nhấn "Đăng nhập với Google"
2. Chuyển hướng đến: `/api/auth/google`
3. OAuthController redirects to Google OAuth
4. User authenticates with Google
5. Google redirects back to: `/auth/google/callback`
6. OAuthController xử lý callback:
   - Kiểm tra user có tồn tại không
   - Nếu không, tạo user mới với role `customer`
   - Tạo Sanctum token
   - Redirect to frontend với token trong query parameter

### Frontend Flow
1. User nhấn Google OAuth button
2. Browser redirects to `/api/auth/google`
3. Sau authentication, Google redirects back với token
4. App lấy token từ query parameter
5. Lưu token vào localStorage
6. Redirect to admin dashboard nếu authenticated

## Database Changes

Migration `2026_04_22_135230_add_oauth_fields_to_users_table` thêm 2 cột:
- `oauth_id`: Google user ID
- `oauth_provider`: OAuth provider name (e.g., 'google')

## API Endpoints

### Public OAuth Routes
- **GET** `/api/auth/google` - Redirect to Google OAuth
- **GET** `/api/auth/google/callback` - Handle Google callback

### Existing Auth Routes (unchanged)
- **POST** `/api/login` - Username/password login
- **POST** `/api/register` - Create new user account
- **POST** `/api/logout` - Logout (authenticated only)
- **GET** `/api/user` - Get current user (authenticated only)

## User Creation on OAuth

Khi user đăng nhập lần đầu bằng Google:
- Username được tạo từ email hoặc tên Google (auto-generated)
- Email được lấy từ Google profile
- Password được random (OAuth users không dùng password)
- Role mặc định: `customer`
- Permissions được sync từ customer role

## Security Notes

1. **Token Storage**: OAuth tokens được lưu trong localStorage (xem xét sử dụng httpOnly cookies cho production)
2. **CSRF Protection**: Sử dụng `stateless()` mode vì API là stateless
3. **Redirect URI**: Phải khớp chính xác với URI trong Google Console
4. **Frontend URL**: Cấu hình FRONTEND_URL trong .env để OAuth callback chuyển hướng đúng

## Testing OAuth

### Development
1. Cấu hình Google credentials (xem trên)
2. Chạy: `php artisan serve`
3. Chạy: `npm run dev`
4. Trên login page, nhấn "Đăng nhập với Google"
5. Hoàn thành authentication với Google account

### Test Credentials
```
Google Test Account: (Sử dụng Google account của bạn)
```

## Troubleshooting

### Error: "Redirect URI mismatch"
- Đảm bảo GOOGLE_REDIRECT_URI trong .env khớp với Google Console settings

### Error: "Invalid client"
- Kiểm tra GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET
- Đảm bảo credentials được sao chép đúng (không có whitespace)

### Token not saving
- Kiểm tra browser localStorage (DevTools > Application > Local Storage)
- Đảm bảo FRONTEND_URL được cấu hình đúng

### User not created
- Kiểm tra logs: `tail -f storage/logs/laravel.log`
- Đảm bảo customer role tồn tại trong database

## Migration to Production

1. Tạo Google OAuth credentials mới cho domain production
2. Cập nhật .env với production credentials
3. Cập nhật GOOGLE_REDIRECT_URI để trỏ đến production URL
4. Thay đổi FRONTEND_URL từ http://127.0.0.1:5173 thành production frontend URL
5. Sử dụng httpOnly cookies thay vì localStorage cho tokens (security improvement)

## Future Enhancements

1. Hỗ trợ thêm OAuth providers (GitHub, Facebook, Microsoft)
2. User profile linking (liên kết Google account với existing user)
3. Social login profiles storage
4. OAuth token refresh mechanism
