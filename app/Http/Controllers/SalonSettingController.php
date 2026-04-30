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

    private function loadPersistedSettings(): array
    {
        $settings = SalonSetting::query()->pluck('value', 'key')->toArray();

        $normalized = [];

        foreach ($settings as $key => $value) {
            if (in_array($key, ['working_hours', 'hero_image'], true) && is_string($value)) {
                $decoded = json_decode($value, true);
                $normalized[$key] = json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
                continue;
            }

            $normalized[$key] = $value;
        }

        return $normalized;
    }

    private function buildSettings(array $baseSettings): array
    {
        $persistedSettings = $this->loadPersistedSettings();
        $cachedSettings = Cache::get(self::CACHE_KEY, []);

        return array_merge($baseSettings, $persistedSettings, $cachedSettings);
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

    /**
     * Get public salon settings
     */
    public function publicSettings()
    {
        try {
            // Get persisted settings from database directly (bypass cache)
            $persistedSettings = $this->loadPersistedSettings();

            // Build base settings with defaults
            $baseSettings = [
                'salon_name' => config('salon.name', 'Nail Salon Pro'),
                'salon_address' => config('salon.address', ''),
                'salon_phone' => config('salon.phone', ''),
                'salon_email' => config('salon.email', ''),
                'working_hours' => config('salon.working_hours', []),
                'slot_duration' => config('salon.appointment.slot_duration', 30),
                'max_advance_days' => config('salon.appointment.max_advance_days', 30),
                'min_advance_hours' => config('salon.appointment.min_advance_hours', 1),
                'hero_image' => null,
            ];

            // Merge: base → persisted (persisted overrides base)
            $settings = array_merge($baseSettings, $persistedSettings);

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

    /**
     * Get all settings (Admin only)
     */
    public function index()
    {
        try {
            // Load persisted settings from database directly
            $persistedSettings = $this->loadPersistedSettings();

            // Base settings from config
            $baseSettings = [
                'salon_name' => config('salon.name', 'Nail Salon Pro'),
                'salon_address' => config('salon.address', ''),
                'salon_phone' => config('salon.phone', ''),
                'salon_email' => config('salon.email', ''),
                'working_hours' => config('salon.working_hours', []),
                'slot_duration' => config('salon.appointment.slot_duration', 30),
                'max_concurrent_appointments' => config('salon.staff.max_concurrent_appointments', 1),
                'max_advance_days' => config('salon.appointment.max_advance_days', 30),
                'min_advance_hours' => config('salon.appointment.min_advance_hours', 1),
                'cancellation_hours' => config('salon.appointment.cancellation_hours', 24),
                'hero_image' => null,
            ];

            // Merge: base settings -> persisted settings (persisted overrides)
            $settings = array_merge($baseSettings, $persistedSettings);

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

    /**
     * Update settings (Admin only)
     */
    public function update(Request $request)
    {
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

            // Filter out null values
            $updateData = array_filter($validated, fn ($value) => $value !== null);

            if (!empty($updateData)) {
                $this->persistSettings($updateData);

                // Clear cache to force reload of persisted settings
                Cache::forget(self::CACHE_KEY);
            }

            // Return full updated settings by rebuilding them
            $updatedSettings = $this->buildSettings([
                'salon_name' => config('salon.name', 'Nail Salon Pro'),
                'salon_address' => config('salon.address', ''),
                'salon_phone' => config('salon.phone', ''),
                'salon_email' => config('salon.email', ''),
                'working_hours' => config('salon.working_hours', []),
                'slot_duration' => config('salon.appointment.slot_duration', 30),
                'max_concurrent_appointments' => config('salon.staff.max_concurrent_appointments', 1),
                'max_advance_days' => config('salon.appointment.max_advance_days', 30),
                'min_advance_hours' => config('salon.appointment.min_advance_hours', 1),
                'cancellation_hours' => config('salon.appointment.cancellation_hours', 24),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cài đặt được cập nhật thành công',
                'data' => $updatedSettings
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi cập nhật cài đặt',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload hero image (Admin only)
     */
    public function uploadHeroImage(Request $request)
    {
        try {
            $request->validate([
                'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:5120' // 5MB
            ]);

            // Delete old image if exists
            $oldSetting = SalonSetting::where('key', 'hero_image')->first();
            if ($oldSetting && $oldSetting->value) {
                $oldValue = $oldSetting->value;
                $oldPath = is_array($oldValue) ? ($oldValue['path'] ?? null) : null;

                if (!$oldPath && is_string($oldValue)) {
                    $decodedOldValue = json_decode($oldValue, true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decodedOldValue)) {
                        $oldPath = $decodedOldValue['path'] ?? null;
                    }
                }

                if ($oldPath) {
                    Storage::disk('public')->delete($oldPath);
                }
            }

            // Store new image
            $path = $request->file('image')->store('hero', 'public');

            // Save to database
            SalonSetting::updateOrCreate(
                ['key' => 'hero_image'],
                ['value' => json_encode(['path' => $path, 'url' => Storage::url($path)])]
            );

            // Clear cache
            Cache::forget(self::CACHE_KEY);

            return response()->json([
                'success' => true,
                'message' => 'Ảnh hero được tải lên thành công',
                'data' => [
                    'path' => $path,
                    'url' => Storage::url($path)
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi tải ảnh hero',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
