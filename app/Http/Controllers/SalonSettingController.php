<?php

namespace App\Http\Controllers;

use App\Models\SalonSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class SalonSettingController extends Controller
{
    private const CACHE_KEY = 'salon_settings';
    private const CACHE_DURATION = 86400; // 24 hours

    private function imageToDataUrl(\Illuminate\Http\UploadedFile $file): string
    {
        $mimeType = $file->getMimeType() ?: 'image/jpeg';
        $contents = file_get_contents($file->getRealPath());

        if ($contents === false) {
            throw new \RuntimeException('Không thể đọc file ảnh đã tải lên.');
        }

        return 'data:' . $mimeType . ';base64,' . base64_encode($contents);
    }

    private function loadPersistedSettings(): array
    {
        $settings = SalonSetting::query()->pluck('value', 'key')->toArray();
        $normalized = [];

        foreach ($settings as $key => $value) {
            if (in_array($key, ['working_hours', 'gallery_images'], true) && is_string($value)) {
                $decoded = json_decode($value, true);
                $normalized[$key] = json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
                continue;
            }

            // Special handling for old hero_image format if it was JSON
            if ($key === 'hero_image' && is_string($value) && str_starts_with($value, '{')) {
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE && isset($decoded['url'])) {
                    $normalized[$key] = $decoded['url'];
                    continue;
                }
            }

            if (is_string($value) && str_starts_with($value, '"')) {
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE && is_string($decoded)) {
                    $normalized[$key] = $decoded;
                    continue;
                }
            }

            $normalized[$key] = $value;
        }

        return $normalized;
    }

    private function buildSettings(array $extraDefaults = []): array
    {
        $defaults = array_merge([
            'salon_name' => config('salon.name', 'Luxury Nails Spa'),
            'salon_address' => config('salon.address', ''),
            'salon_phone' => config('salon.phone', '0900 123 456'),
            'salon_email' => config('salon.email', ''),
            'working_hours' => config('salon.working_hours', []),
            'slot_duration' => config('salon.appointment.slot_duration', 30),
            'max_advance_days' => config('salon.appointment.max_advance_days', 30),
            'min_advance_hours' => config('salon.appointment.min_advance_hours', 1),
            'max_concurrent_appointments' => config('salon.staff.max_concurrent_appointments', 1),
            'cancellation_hours' => config('salon.appointment.cancellation_hours', 24),
            'hero_image' => '',
            'logo' => '',
            'gallery_images' => [],
        ], $extraDefaults);

        $persisted = $this->loadPersistedSettings();
        $cached = Cache::get(self::CACHE_KEY, []);

        return array_merge($defaults, $persisted, $cached);
    }

    private function persistSettings(array $settings): void
    {
        foreach ($settings as $key => $value) {
            $storedValue = is_array($value) || is_object($value)
                ? json_encode($value)
                : $value;

            SalonSetting::updateOrCreate(
                ['key' => $key],
                ['value' => $storedValue]
            );
        }
    }

    public function publicSettings()
    {
        try {
            $settings = $this->buildSettings();
            return response()->json([
                'success' => true,
                'data' => $settings
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy thông tin quán',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function index()
    {
        $user = auth('web')->user() ?: auth('sanctum')->user();
        if (!$user) {
             return response()->json(['success' => false, 'message' => 'Lỗi xác thực: Vui lòng đăng nhập lại.'], 401);
        }

        try {
            $settings = $this->buildSettings();
            return response()->json([
                'success' => true,
                'data' => $settings
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy cài đặt',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request)
    {
        $user = auth('web')->user() ?: auth('sanctum')->user();
        if (!$user) {
             return response()->json(['success' => false, 'message' => 'Lỗi xác thực: Vui lòng đăng nhập lại.'], 401);
        }

        if (!$user->hasPermissionTo('edit_settings')) {
             return response()->json(['success' => false, 'message' => 'Bạn không có quyền thực hiện hành động này.'], 403);
        }

        try {
            $validated = $request->validate([
                'salon_name' => 'nullable|string|max:255',
                'salon_address' => 'nullable|string',
                'salon_phone' => 'nullable|string|max:20',
                'salon_email' => 'nullable|email',
                'working_hours' => 'nullable|array',
                'slot_duration' => 'nullable|integer|min:5|max:120',
                'max_concurrent_appointments' => 'nullable|integer|min:1',
                'max_advance_days' => 'nullable|integer|min:1|max:365',
                'min_advance_hours' => 'nullable|integer|min:0',
                'cancellation_hours' => 'nullable|integer|min:0|max:168'
            ]);

            $updateData = array_filter($validated, fn ($value) => $value !== null);

            if (!empty($updateData)) {
                $this->persistSettings($updateData);
                
                // Refresh all settings for cache
                $allSettings = $this->loadPersistedSettings();
                Cache::put(self::CACHE_KEY, $allSettings, self::CACHE_DURATION);
            }

            return response()->json([
                'success' => true,
                'message' => 'Cài đặt được cập nhật thành công',
                'data' => $this->buildSettings()
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi cập nhật cài đặt',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function uploadImage(Request $request)
    {
        $user = auth('web')->user() ?: auth('sanctum')->user();
        if (!$user) {
             return response()->json(['success' => false, 'message' => 'Lỗi xác thực: Vui lòng đăng nhập lại.'], 401);
        }

        if (!$user->hasPermissionTo('edit_settings')) {
             return response()->json(['success' => false, 'message' => 'Bạn không có quyền thực hiện hành động này.'], 403);
        }

        try {
            $request->validate([
                'image' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:5120',
                'type' => 'required|string|in:hero_image,logo,gallery'
            ]);

            $type = $request->input('type');
            $file = $request->file('image');
            $imageUrl = $this->imageToDataUrl($file);
            $persisted = $this->loadPersistedSettings();

            if ($type === 'gallery') {
                $gallery = $persisted['gallery_images'] ?? [];
                $gallery[] = $imageUrl;
                $persisted['gallery_images'] = $gallery;
            } else {
                if (isset($persisted[$type]) && !str_starts_with((string) $persisted[$type], 'data:image/')) {
                    $oldPath = str_replace('/storage/', '', $persisted[$type]);
                    if (Storage::disk('public')->exists($oldPath)) {
                        Storage::disk('public')->delete($oldPath);
                    }
                }
                $persisted[$type] = $imageUrl;
            }

            $this->persistSettings($persisted);
            Cache::put(self::CACHE_KEY, $persisted, self::CACHE_DURATION);

            return response()->json([
                'success' => true,
                'message' => 'Tải ảnh lên thành công',
                'data' => [
                    'url' => $imageUrl,
                    'type' => $type
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi tải ảnh lên',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function deleteImage(Request $request)
    {
        $user = auth('web')->user() ?: auth('sanctum')->user();
        if (!$user) {
             return response()->json(['success' => false, 'message' => 'Lỗi xác thực: Vui lòng đăng nhập lại.'], 401);
        }

        if (!$user->hasPermissionTo('edit_settings')) {
             return response()->json(['success' => false, 'message' => 'Bạn không có quyền thực hiện hành động này.'], 403);
        }

        try {
            $request->validate([
                'url' => 'required|string',
                'type' => 'required|string|in:hero_image,logo,gallery'
            ]);

            $type = $request->input('type');
            $url = $request->input('url');

            if (!str_starts_with($url, 'data:image/')) {
                $path = str_replace('/storage/', '', $url);

                if (Storage::disk('public')->exists($path)) {
                    Storage::disk('public')->delete($path);
                }
            }

            $persisted = $this->loadPersistedSettings();

            if ($type === 'gallery') {
                $gallery = $persisted['gallery_images'] ?? [];
                $gallery = array_values(array_filter($gallery, fn($img) => $img !== $url));
                $persisted['gallery_images'] = $gallery;
            } else {
                unset($persisted[$type]);
            }

            $this->persistSettings($persisted);
            Cache::put(self::CACHE_KEY, $persisted, self::CACHE_DURATION);

            return response()->json([
                'success' => true,
                'message' => 'Xóa ảnh thành công'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi xóa ảnh',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
