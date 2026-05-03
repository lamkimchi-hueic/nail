<?php

namespace App\Http\Controllers;

use App\Models\SalonSetting;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class ServiceController extends Controller
{
    private function toPublicUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (str_starts_with($path, 'data:image/')) {
            return $path;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        return asset('storage/' . ltrim($path, '/'));
    }

    private function imageToDataUrl(\Illuminate\Http\UploadedFile $file): string
    {
        $mimeType = $file->getMimeType() ?: 'image/jpeg';
        $contents = file_get_contents($file->getRealPath());

        if ($contents === false) {
            throw new \RuntimeException('Không thể đọc file ảnh đã tải lên.');
        }

        return 'data:' . $mimeType . ';base64,' . base64_encode($contents);
    }

    private function serviceImageKey(int $serviceId): string
    {
        return 'service_image_' . $serviceId;
    }

    private function serviceImage(Service $service): ?string
    {
        $settingImage = SalonSetting::query()
            ->where('key', $this->serviceImageKey((int) $service->id))
            ->value('value');

        if ($settingImage) {
            if (is_string($settingImage) && str_starts_with($settingImage, '"')) {
                $decoded = json_decode($settingImage, true);
                if (json_last_error() === JSON_ERROR_NONE && is_string($decoded)) {
                    return $decoded;
                }
            }

            return (string) $settingImage;
        }

        return $service->image;
    }

    private function attachImageUrl(Service $service): Service
    {
        $service->image_url = $this->toPublicUrl($this->serviceImage($service));
        return $service;
    }

    private function persistServiceImage(Service $service, \Illuminate\Http\UploadedFile $file): void
    {
        SalonSetting::query()->updateOrCreate(
            ['key' => $this->serviceImageKey((int) $service->id)],
            ['value' => $this->imageToDataUrl($file)]
        );
    }

    // Get all services
    public function index()
    {
        try {
            $services = Cache::remember('public_services', now()->addMinutes(10), function () {
                return Service::where('is_active', true)->get()->map(function (Service $service) {
                    return $this->attachImageUrl($service);
                });
            });
            return response()->json([
                'success' => true,
                'data' => $services
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy danh sách dịch vụ',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Get single service
    public function show($id)
    {
        try {
            $service = Service::findOrFail($id);
            $this->attachImageUrl($service);

            return response()->json([
                'success' => true,
                'data' => $service
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dịch vụ không tìm thấy'
            ], 404);
        }
    }

    // Create new service (Admin only)
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:255|unique:services',
                'description' => 'nullable|string',
                'price' => 'required|numeric|min:0',
                'duration' => 'required|integer|min:1|max:480',
                'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
                'is_active' => 'nullable|boolean'
            ]);

            $imageFile = $request->file('image');
            unset($validated['image']);

            $validated['is_active'] = $validated['is_active'] ?? true;

            $service = Service::create($validated);
            if ($imageFile) {
                $this->persistServiceImage($service, $imageFile);
            }

            Cache::forget('public_services');
            $this->attachImageUrl($service);

            return response()->json([
                'success' => true,
                'message' => 'Dịch vụ được tạo thành công',
                'data' => $service
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi tạo dịch vụ',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Update service (Admin only)
    public function update(Request $request, $id)
    {
        try {
            $service = Service::findOrFail($id);

            $validated = $request->validate([
                'name' => 'sometimes|string|max:255|unique:services,name,' . $id,
                'description' => 'nullable|string',
                'price' => 'sometimes|numeric|min:0',
                'duration' => 'sometimes|integer|min:1|max:480',
                'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:4096',
                'is_active' => 'nullable|boolean'
            ]);

            $imageFile = $request->file('image');
            unset($validated['image']);

            if ($imageFile) {
                if ($service->image && !str_starts_with($service->image, 'http') && !str_starts_with($service->image, 'data:image/')) {
                    Storage::disk('public')->delete($service->image);
                }
                $this->persistServiceImage($service, $imageFile);
            }

            $service->update($validated);
            Cache::forget('public_services');
            $this->attachImageUrl($service);

            return response()->json([
                'success' => true,
                'message' => 'Dịch vụ được cập nhật thành công',
                'data' => $service
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dịch vụ không tìm thấy'
            ], 404);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi cập nhật dịch vụ',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Delete service (Admin only)
    public function destroy($id)
    {
        try {
            $service = Service::findOrFail($id);

            if ($service->image && !str_starts_with($service->image, 'http') && !str_starts_with($service->image, 'data:image/')) {
                Storage::disk('public')->delete($service->image);
            }
            SalonSetting::query()->where('key', $this->serviceImageKey((int) $service->id))->delete();

            $service->delete();
            Cache::forget('public_services');

            return response()->json([
                'success' => true,
                'message' => 'Dịch vụ được xóa thành công'
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dịch vụ không tìm thấy'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi xóa dịch vụ',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
