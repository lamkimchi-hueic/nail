<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // Register
    public function register(Request $request)
    {
        try {
            $validated = $request->validate([
                'username' => 'required|string|max:50|unique:users',
                'email' => 'required|string|email|max:255|unique:users',
                'name' => 'nullable|string|max:100',
                'phone' => 'nullable|string|max:20|unique:users',
                'password' => 'required|string|min:8|confirmed',
                'role' => 'nullable|in:admin,customer'
            ], [
                'username.unique' => 'Tên đăng nhập này đã có người sử dụng.',
                'email.unique' => 'Email này đã được đăng ký tài khoản.',
                'email.email' => 'Địa chỉ email không hợp lệ.',
                'phone.unique' => 'Số điện thoại này đã được sử dụng.',
                'password.min' => 'Mật khẩu phải có ít nhất 8 ký tự.',
                'password.confirmed' => 'Xác nhận mật khẩu không khớp.',
                'username.required' => 'Vui lòng nhập tên đăng nhập.',
                'email.required' => 'Vui lòng nhập email.',
                'password.required' => 'Vui lòng nhập mật khẩu.'
            ]);

            $role = $validated['role'] ?? 'customer';

            $user = User::create([
                'username' => $validated['username'],
                'email' => $validated['email'],
                'name' => $validated['name'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($validated['password']),
                'role' => $role
            ]);

            // Sync role with appropriate permissions
            $user->syncRoles([$role]);

            // Sync permissions based on role
            $roleModel = \Spatie\Permission\Models\Role::where('name', $role)->first();
            if ($roleModel) {
                $user->syncPermissions($roleModel->permissions);
            }

            // Create Sanctum token
            $token = $user->createToken('auth_token')->plainTextToken;

            // Create session-based auth for web guard requests
            Auth::login($user);
            $request->session()->regenerate();

            $message = $role === 'admin' ? 'Đăng ký admin thành công' : 'Đăng ký khách hàng thành công';

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'user' => $user,
                    'token' => $token,
                ]
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi đăng ký',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Login - Accepts username or email
    public function login(Request $request)
    {
        try {
            $validated = $request->validate([
                'username' => 'required|string',
                'password' => 'required|string'
            ]);

            // Find user by username or email
            $user = User::where('username', $validated['username'])
                        ->orWhere('email', $validated['username'])
                        ->first();

            if (!$user || !Hash::check($validated['password'], $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Username/Email hoặc mật khẩu không chính xác'
                ], 401);
            }

            // Allow both admin and customer roles
            $role = $user->role;
            if (!in_array($role, ['admin', 'customer'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Vai trò người dùng không hợp lệ'
                ], 403);
            }

            // Sync role with appropriate permissions
            $user->syncRoles([$role]);

            // Sync permissions based on role
            $roleModel = \Spatie\Permission\Models\Role::where('name', $role)->first();
            if ($roleModel) {
                $user->syncPermissions($roleModel->permissions);
            }

            // Create Sanctum token
            $token = $user->createToken('auth_token')->plainTextToken;

            // Create session-based auth for web guard requests
            Auth::login($user);
            $request->session()->regenerate();

            return response()->json([
                'success' => true,
                'message' => 'Đăng nhập thành công',
                'data' => [
                    'user' => $user,
                    'token' => $token,
                ]
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi đăng nhập',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Get current user
    public function user()
    {
        try {
            $user = Auth::user();

            if (!$user instanceof User) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chưa xác thực'
                ], 401);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                    'roles' => $user->getRoleNames(),
                    'permissions' => $user->getPermissionNames(),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy thông tin người dùng',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Logout
    public function logout()
    {
        try {
            Auth::logout();
            request()->session()->invalidate();
            request()->session()->regenerateToken();

            return response()->json([
                'success' => true,
                'message' => 'Đăng xuất thành công'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi đăng xuất',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
