<?php

namespace App\Http\Controllers;

use App\Models\Staff;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

class StaffController extends Controller
{
    /**
     * Get all staff members
     */
    public function index(Request $request)
    {
        try {
            if (!$request->has('search') && !$request->has('per_page')) {
                $staff = Cache::remember('public_staffs', now()->addMinutes(10), function () {
                    return Staff::orderBy('name')->get();
                });

                return response()->json([
                    'success' => true,
                    'data' => $staff
                ]);
            }

            $query = Staff::query();

            // Search by name or specialty
            if ($request->has('search')) {
                $search = $request->input('search');
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('specialty', 'like', "%{$search}%");
            }

            // Pagination
            $perPage = $request->input('per_page', 15);
            $staff = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $staff
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy danh sách nhân viên',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get a single staff member
     */
    public function show($id)
    {
        try {
            $staff = Staff::findOrFail($id);

            // Load related appointments
            $upcomingAppointments = $staff->appointments()
                ->where('status', '!=', 'completed')
                ->where('status', '!=', 'cancelled')
                ->orderBy('appointment_date')
                ->get();

            $staff['upcoming_appointments'] = $upcomingAppointments;

            return response()->json([
                'success' => true,
                'data' => $staff
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Nhân viên không tồn tại'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy thông tin nhân viên',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a new staff member (Admin only)
     */
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'required|string|max:100|unique:staffs',
                'specialty' => 'nullable|string|max:100',
            ]);

            $staff = Staff::create($validated);
            Cache::forget('public_staffs');

            return response()->json([
                'success' => true,
                'message' => 'Nhân viên được tạo thành công',
                'data' => $staff
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
                'message' => 'Lỗi khi tạo nhân viên',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update a staff member (Admin only)
     */
    public function update(Request $request, $id)
    {
        try {
            $staff = Staff::findOrFail($id);

            $validated = $request->validate([
                'name' => 'sometimes|string|max:100|unique:staffs,name,' . $id,
                'specialty' => 'nullable|string|max:100',
            ]);

            $staff->update($validated);
            Cache::forget('public_staffs');

            return response()->json([
                'success' => true,
                'message' => 'Nhân viên được cập nhật thành công',
                'data' => $staff
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Nhân viên không tồn tại'
            ], 404);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi cập nhật nhân viên',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a staff member (Admin only)
     */
    public function destroy($id)
    {
        try {
            $staff = Staff::findOrFail($id);

            // Check if staff has any active appointments
            $activeAppointments = $staff->appointments()
                ->where('status', '!=', 'completed')
                ->where('status', '!=', 'cancelled')
                ->count();

            if ($activeAppointments > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể xóa nhân viên có các cuộc hẹn đang hoạt động'
                ], 400);
            }

            $staff->delete();
            Cache::forget('public_staffs');

            return response()->json([
                'success' => true,
                'message' => 'Nhân viên được xóa thành công'
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Nhân viên không tồn tại'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi xóa nhân viên',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available slots for a staff member on a specific date
     */
    public function availableSlots($id, Request $request)
    {
        try {
            $staff = Staff::findOrFail($id);
            $date = $request->input('date');

            if (!$date) {
                return response()->json([
                    'success' => false,
                    'message' => 'Ngày là bắt buộc'
                ], 422);
            }

            // Get appointment durations for this date
            $appointments = $staff->appointments()
                ->whereDate('appointment_date', $date)
                ->where('status', '!=', 'cancelled')
                ->get(['appointment_time', 'id']);

            // Calculate available slots based on salon settings
            $slotDuration = config('salon.appointment.slot_duration', 30);
            $openingHours = config('salon.working_hours', []);

            // Get day name and opening hours
            $dayName = strtolower(\Carbon\Carbon::parse($date)->format('l'));
            $dayHours = $openingHours[$dayName] ?? null;

            if (!$dayHours || $dayHours['closed']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Quán đóng cửa vào ngày này',
                    'data' => []
                ]);
            }

            // Generate available slots
            $availableSlots = $this->generateAvailableSlots(
                $date,
                $dayHours['open'],
                $dayHours['close'],
                $slotDuration,
                $appointments
            );

            return response()->json([
                'success' => true,
                'data' => $availableSlots
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Nhân viên không tồn tại'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy khung giờ trống',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate available time slots
     */
    private function generateAvailableSlots($date, $openTime, $closeTime, $duration, $appointments)
    {
        $slots = [];
        $current = \Carbon\Carbon::createFromFormat('Y-m-d H:i', "$date $openTime");
        $end = \Carbon\Carbon::createFromFormat('Y-m-d H:i', "$date $closeTime");

        $bookedTimes = $appointments->pluck('appointment_time')->toArray();

        while ($current < $end) {
            $timeStr = $current->format('H:i');
            $isBooked = in_array($timeStr, $bookedTimes);

            $slots[] = [
                'time' => $timeStr,
                'available' => !$isBooked
            ];

            $current->addMinutes($duration);
        }

        return $slots;
    }
}
