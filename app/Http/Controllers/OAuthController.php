<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\SpatieRoleSetup;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class OAuthController extends Controller
{
    /**
     * Redirect to Google OAuth provider
     */
    public function redirectToGoogle()
    {
        try {
            $redirect = config('services.google.redirect') ?: env('GOOGLE_REDIRECT_URI', env('APP_URL') . '/api/auth/google/callback');
            return Socialite::driver('google')->stateless()->redirectUrl($redirect)->redirect();
        } catch (\Exception $e) {
            $redirectUrl = env('FRONTEND_URL', 'http://127.0.0.1:5173') .
                           '?error=' . urlencode('Failed to redirect to Google: ' . $e->getMessage());
            return redirect($redirectUrl);
        }
    }

    /**
     * Handle Google OAuth callback
     */
    public function handleGoogleCallback()
    {
        try {
            $redirect = config('services.google.redirect') ?: env('GOOGLE_REDIRECT_URI', env('APP_URL') . '/api/auth/google/callback');
            $googleUser = Socialite::driver('google')->stateless()->redirectUrl($redirect)->user();

            // Find or create user from Google data
            $user = User::where('oauth_id', $googleUser->getId())
                        ->where('oauth_provider', 'google')
                        ->first();

            if (!$user) {
                // Check if email already exists
                $user = User::where('email', $googleUser->getEmail())->first();

                if (!$user) {
                    // Caching the Google data and redirecting for password creation
                    $setupToken = Str::random(40);
                    Cache::put('oauth_setup_' . $setupToken, [
                        'name' => $googleUser->getName(),
                        'email' => $googleUser->getEmail(),
                        'oauth_id' => $googleUser->getId(),
                        'oauth_provider' => 'google'
                    ], now()->addMinutes(15));
                    
                    $redirectUrl = env('FRONTEND_URL', 'http://127.0.0.1:8000') .
                                   '?setup_token=' . urlencode($setupToken) . 
                                   '&setup_email=' . urlencode($googleUser->getEmail()) .
                                   '&setup_name=' . urlencode($googleUser->getName());
                    
                    return redirect($redirectUrl);
                } else {
                    // Link existing email to OAuth
                    $user->update([
                        'oauth_id' => $googleUser->getId(),
                        'oauth_provider' => 'google'
                    ]);
                }
            } else {
                // Update user info if needed
                $user->update([
                    'name' => $googleUser->getName(),
                    'email' => $googleUser->getEmail(),
                ]);
            }

            // Create Sanctum token
            $token = $user->createToken('oauth_token')->plainTextToken;

            // Redirect to frontend with token
            $redirectUrl = env('FRONTEND_URL', 'http://127.0.0.1:5173') .
                           '?token=' . urlencode($token);

            return redirect($redirectUrl);
        } catch (\Exception $e) {
            $redirectUrl = env('FRONTEND_URL', 'http://127.0.0.1:5173') .
                           '?error=' . urlencode('OAuth login failed: ' . $e->getMessage());
            return redirect($redirectUrl);
        }
    }

    /**
     * Generate unique username from name
     */
    private function generateUniqueUsername($name)
    {
        $baseUsername = strtolower(str_replace(' ', '_', trim($name)));
        // Remove special characters
        $baseUsername = preg_replace('/[^a-z0-9_]/', '', $baseUsername);

        if (empty($baseUsername)) {
            $baseUsername = 'user';
        }

        $username = $baseUsername;
        $counter = 1;

        while (User::where('username', $username)->exists()) {
            $username = $baseUsername . '_' . $counter;
            $counter++;
        }

        return $username;
    }

    /**
     * Complete registration for new OAuth users
     */
    public function completeRegistration(Request $request)
    {
        try {
            SpatieRoleSetup::ensure();

            $validated = $request->validate([
                'setup_token' => 'required|string',
                'password' => 'required|string|min:8|confirmed',
                'phone' => 'nullable|string|max:20'
            ]);

            $cacheKey = 'oauth_setup_' . $validated['setup_token'];
            $googleData = Cache::get($cacheKey);

            if (!$googleData) {
                return response()->json([
                    'success' => false,
                    'message' => 'Phiên đăng ký đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại với Google.'
                ], 400);
            }

            // Create user
            $user = User::create([
                'username' => $this->generateUniqueUsername($googleData['name']),
                'name' => $googleData['name'],
                'email' => $googleData['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => Hash::make($validated['password']),
                'role' => 'customer',
                'oauth_id' => $googleData['oauth_id'],
                'oauth_provider' => $googleData['oauth_provider']
            ]);

            // Assign role
            $user->syncRoles(['customer']);
            $roleModel = \Spatie\Permission\Models\Role::where('name', 'customer')->first();
            if ($roleModel) {
                $user->syncPermissions($roleModel->permissions);
            }

            // Clear cache
            Cache::forget($cacheKey);

            // Create Sanctum token
            $token = $user->createToken('auth_token')->plainTextToken;

            // Session login for web guard
            Auth::login($user);
            $request->session()->regenerate();

            return response()->json([
                'success' => true,
                'message' => 'Đăng ký thành công',
                'data' => [
                    'user' => $user,
                    'token' => $token
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi hoàn tất đăng ký',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Logout user
     */
    public function logout()
    {
        try {
            // Revoke all tokens
            Auth::user()?->tokens()?->delete();

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
