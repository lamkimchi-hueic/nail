<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\AppointmentDetail;
use App\Models\Service;
use App\Models\User;
use App\Support\SpatieRoleSetup;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AppointmentController extends Controller
{
    private function normalizePhone(?string $phone): string
    {
        return preg_replace('/\D/', '', (string) $phone);
    }

    private function makeGuestUsername(string $phone): string
    {
        $digits = $this->normalizePhone($phone);
        return Str::limit('guest_' . ($digits ?: 'user') . '_' . time(), 50, '');
    }

    private function isTimeSlotBooked(int $staffId, Carbon $appointmentDateTime, ?int $ignoreAppointmentId = null): bool
    {
        $query = Appointment::where('staff_id', $staffId)
            ->whereIn('status', ['pending', 'confirmed'])
            ->where('appointment_date', $appointmentDateTime->format('Y-m-d H:i:s'));

        if ($ignoreAppointmentId) {
            $query->where('id', '!=', $ignoreAppointmentId);
        }

        return $query->exists();
    }

    private function canGuestAccessAppointment(Appointment $appointment, ?string $phone): bool
    {
        if (!$phone) {
            return false;
        }

        $appointment->loadMissing('user');

        return $this->normalizePhone($appointment->user->phone ?? '') === $this->normalizePhone($phone);
    }

    private function sortByNearestNow($appointments)
    {
        $now = Carbon::now();

        return $appointments
            ->sortBy(function ($appointment) use ($now) {
                $dateTime = Carbon::parse($appointment->appointment_date);
                return abs($now->diffInSeconds($dateTime, false));
            })
            ->values();
    }

    private function getWorkingHoursSettings(): array
    {
        $cachedSettings = Cache::get('salon_settings', []);
        $workingHours = $cachedSettings['working_hours'] ?? config('salon.working_hours', []);

        return is_array($workingHours) ? $workingHours : [];
    }

    private function isWithinWorkingHours(Carbon $appointmentDateTime): bool
    {
        $workingHours = $this->getWorkingHoursSettings();
        $dayKey = strtolower($appointmentDateTime->englishDayOfWeek);

        if (!isset($workingHours[$dayKey]) || !is_array($workingHours[$dayKey])) {
            return true;
        }

        $daySettings = $workingHours[$dayKey];
        if (($daySettings['closed'] ?? false) === true) {
            return false;
        }

        $open = $daySettings['open'] ?? null;
        $close = $daySettings['close'] ?? null;
        if (!$open || !$close) {
            return true;
        }

        $openTime = Carbon::createFromFormat('Y-m-d H:i', $appointmentDateTime->format('Y-m-d') . ' ' . $open);
        $closeTime = Carbon::createFromFormat('Y-m-d H:i', $appointmentDateTime->format('Y-m-d') . ' ' . $close);

        if ($closeTime->lessThanOrEqualTo($openTime)) {
            return false;
        }

        return $appointmentDateTime->betweenIncluded($openTime, $closeTime);
    }

    // Public schedule by date (for homepage timetable)
    public function publicSchedule(Request $request)
    {
        try {
            $validated = $request->validate([
                'date' => 'required|date',
            ]);

            $date = Carbon::parse($validated['date']);

            $appointments = Appointment::with(['user', 'services'])
                ->whereDate('appointment_date', $date)
                ->whereIn('status', ['pending', 'confirmed'])
                ->orderBy('appointment_date', 'asc')
                ->get();

            $bookedSlots = $appointments
                ->map(fn ($apt) => Carbon::parse($apt->appointment_date)->format('H:i'))
                ->unique()
                ->values();

            $items = $appointments->map(function ($apt) {
                return [
                    'id' => $apt->id,
                    'time' => Carbon::parse($apt->appointment_date)->format('H:i'),
                    'status' => $apt->status,
                    'customer_name' => $apt->user->name ?? $apt->user->username ?? 'Khách',
                    'services' => $apt->services->pluck('name')->values(),
                ];
            })->values();

            return response()->json([
                'success' => true,
                'data' => [
                    'date' => $date->toDateString(),
                    'booked_slots' => $bookedSlots,
                    'appointments' => $items,
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
                'message' => 'Lỗi khi lấy thời khóa biểu',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Get all appointments (Admin)
    public function index(Request $request)
    {
        try {
            $this->authorize('viewAny', Appointment::class);

            $query = Appointment::with(['user', 'staff', 'services'])
                ->where('appointment_date', '>=', Carbon::now());

            // Filter by date range
            if ($request->has('start_date') && $request->has('end_date')) {
                $startDate = Carbon::parse($request->start_date)->startOfDay();
                $endDate = Carbon::parse($request->end_date)->endOfDay();
                $query->whereBetween('appointment_date', [$startDate, $endDate]);
            }

            // Filter by status
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            $appointments = $this->sortByNearestNow($query->get());

            return response()->json([
                'success' => true,
                'data' => $appointments
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền truy cập danh sách lịch hẹn'
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy danh sách lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Get appointments by date range
    public function getByDateRange(Request $request)
    {
        try {
            $this->authorize('viewAny', Appointment::class);

            $validated = $request->validate([
                'start_date' => 'required|date',
                'end_date' => 'required|date|after:start_date'
            ]);

            $startDate = Carbon::parse($validated['start_date'])->startOfDay();
            $endDate = Carbon::parse($validated['end_date'])->endOfDay();

            $appointments = Appointment::with(['user', 'staff', 'services'])
                ->whereBetween('appointment_date', [$startDate, $endDate])
                ->orderBy('appointment_date', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $appointments
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền xem lịch hẹn theo khoảng ngày'
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Create appointment (Customer - from booking form)
    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'phone' => 'nullable|string|max:20',
                'name' => 'nullable|string|max:255',
                'appointment_date' => 'required|date|after:now',
                'staff_id' => 'nullable|exists:staffs,id',
                'services' => 'required|array|min:1',
                'services.*' => 'exists:services,id',
                'notes' => 'nullable|string',
            ]);

            $appointmentDateTime = Carbon::parse($validated['appointment_date'], config('app.timezone'));

            if (!$this->isWithinWorkingHours($appointmentDateTime)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này ngoài giờ làm việc, hãy xem lại giờ làm việc.',
                ], 422);
            }

            $staffId = $validated['staff_id'] ?? \App\Models\Staff::first()?->id ?? 1;

            if ($this->isTimeSlotBooked((int) $staffId, $appointmentDateTime)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này đã có lịch, vui lòng chọn giờ khác.',
                ], 409);
            }

            $appointment = DB::transaction(function () use ($validated, $appointmentDateTime, $staffId) {
                $user = Auth::user();

                if (!$user) {
                    throw new \Exception('Unauthorized');
                }

                // Update phone if provided and missing
                if (empty($user->phone) && !empty($validated['phone'])) {
                    $user->phone = $this->normalizePhone($validated['phone']);
                    $user->save();
                }

                // Update name if provided and not already set
                if (!empty($validated['name']) && empty($user->name)) {
                    $user->name = $validated['name'];
                    $user->save();
                }

                // Calculate total price
                $services = \App\Models\Service::whereIn('id', $validated['services'])->get();
                $totalPrice = $services->sum('price');

                // Create appointment
                $appointment = Appointment::create([
                    'user_id' => $user->id,
                    'staff_id' => $staffId,
                    'appointment_date' => $appointmentDateTime,
                    'total_price' => $totalPrice,
                    'status' => 'pending',
                    'notes' => $validated['notes'] ?? null
                ]);

                // Create appointment details
                foreach ($validated['services'] as $serviceId) {
                    AppointmentDetail::create([
                        'appointment_id' => $appointment->id,
                        'service_id' => $serviceId
                    ]);
                }

                return $appointment;
            });

            // Load relationships
            $appointment->load(['user', 'staff', 'services']);

            return response()->json([
                'success' => true,
                'message' => 'Lịch hẹn được tạo thành công. Chúng tôi sẽ liên hệ xác nhận trong 24 giờ.',
                'data' => $appointment
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
                'message' => 'Lỗi khi tạo lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Create appointment manually (Admin)
    public function createManual(Request $request)
    {
        try {
            SpatieRoleSetup::ensure();

            $this->authorize('create', Appointment::class);

            $validated = $request->validate([
                'user_id' => 'nullable|exists:users,id',
                'phone' => 'required_without:user_id|string|max:20',
                'name' => 'required_without:user_id|string|max:255',
                'appointment_date' => 'required|date|after:now',
                'staff_id' => 'required|exists:staffs,id',
                'services' => 'required|array|min:1',
                'services.*' => 'exists:services,id',
                'notes' => 'nullable|string'
            ]);

            $appointmentDateTime = Carbon::parse($validated['appointment_date']);

            $staffId = $validated['staff_id'] ?? \App\Models\Staff::first()?->id ?? 1;

            if ($this->isTimeSlotBooked((int) $staffId, $appointmentDateTime)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này đã có lịch, vui lòng chọn giờ khác.',
                ], 409);
            }

            $appointment = DB::transaction(function () use ($validated, $appointmentDateTime, $staffId) {
                // Get or create user
                if (!isset($validated['user_id'])) {
                    $normalizedPhone = $this->normalizePhone($validated['phone']);
                    $user = User::firstOrCreate(
                        ['phone' => $normalizedPhone],
                        [
                            'username' => $this->makeGuestUsername($normalizedPhone),
                            'password' => Hash::make(Str::random(16)),
                            'role' => 'customer',
                        ]
                    );
                    $user->syncRoles(['customer']);
                } else {
                    $user = User::findOrFail($validated['user_id']);
                }

                // Calculate total price
                $services = \App\Models\Service::whereIn('id', $validated['services'])->get();
                $totalPrice = $services->sum('price');

                // Create appointment
                $appointment = Appointment::create([
                    'user_id' => $user->id,
                    'staff_id' => $staffId,
                    'appointment_date' => $appointmentDateTime,
                    'total_price' => $totalPrice,
                    'status' => 'confirmed',
                    'notes' => $validated['notes'] ?? null
                ]);

                // Create appointment details
                foreach ($validated['services'] as $serviceId) {
                    AppointmentDetail::create([
                        'appointment_id' => $appointment->id,
                        'service_id' => $serviceId
                    ]);
                }

                return $appointment;
            });

            $appointment->load(['user', 'staff', 'services']);

            return response()->json([
                'success' => true,
                'message' => 'Lịch hẹn được tạo thành công',
                'data' => $appointment
            ], 201);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền tạo lịch hẹn thủ công'
            ], 403);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Create Manual Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi tạo lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Update appointment by admin
    public function adminUpdate(Request $request, $id)
    {
        try {
            $this->authorize('manage', Appointment::class);

            $validated = $request->validate([
                'user_id' => 'nullable|exists:users,id',
                'name' => 'nullable|string|max:255',
                'phone' => 'nullable|string|max:255',
                'appointment_date' => 'nullable|date',
                'staff_id' => 'nullable|exists:staffs,id',
                'services' => 'nullable|array|min:1',
                'services.*' => 'exists:services,id',
                'notes' => 'nullable|string',
                'status' => 'nullable|in:pending,confirmed,rejected,in-process,completed,cancelled,no-show'
            ]);

            $appointment = Appointment::with(['user', 'staff', 'services'])->findOrFail($id);

            $targetStaffId = (int) ($validated['staff_id'] ?? $appointment->staff_id);
            $targetDateTime = isset($validated['appointment_date'])
                ? Carbon::parse($validated['appointment_date'])
                : Carbon::parse($appointment->appointment_date);

            if (!$this->isWithinWorkingHours($targetDateTime)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này ngoài giờ làm việc, hãy xem lại giờ làm việc.'
                ], 422);
            }

            if ($this->isTimeSlotBooked($targetStaffId, $targetDateTime, (int) $appointment->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này đã có lịch, vui lòng chọn giờ khác.'
                ], 409);
            }

            DB::transaction(function () use ($validated, $appointment, $targetStaffId, $targetDateTime) {
                // Update associated user if name or phone provided
                if ($appointment->user && (isset($validated['name']) || isset($validated['phone']))) {
                    $userData = [];
                    if (isset($validated['name'])) $userData['name'] = $validated['name'];
                    if (isset($validated['phone'])) $userData['phone'] = $this->normalizePhone($validated['phone']);
                    $appointment->user->update($userData);
                }

                $updateData = [
                    'staff_id' => $targetStaffId,
                    'appointment_date' => $targetDateTime,
                ];

                if (isset($validated['user_id'])) {
                    $updateData['user_id'] = $validated['user_id'];
                }

                if (array_key_exists('notes', $validated)) {
                    $updateData['notes'] = $validated['notes'];
                }

                if (isset($validated['status'])) {
                    $updateData['status'] = $validated['status'];
                }

                if (isset($validated['services'])) {
                    $services = Service::whereIn('id', $validated['services'])->get();
                    $updateData['total_price'] = $services->sum('price');

                    AppointmentDetail::where('appointment_id', $appointment->id)->delete();
                    foreach ($validated['services'] as $serviceId) {
                        AppointmentDetail::create([
                            'appointment_id' => $appointment->id,
                            'service_id' => $serviceId,
                        ]);
                    }
                }

                $appointment->update($updateData);
            });

            $appointment->load(['user', 'staff', 'services']);

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật lịch hẹn thành công',
                'data' => $appointment
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền cập nhật lịch hẹn'
            ], 403);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi cập nhật lịch hẹn',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // Delete appointment by admin
    public function adminDelete($id)
    {
        try {
            $this->authorize('manage', Appointment::class);

            $appointment = Appointment::findOrFail($id);
            $appointment->delete();

            return response()->json([
                'success' => true,
                'message' => 'Xóa lịch hẹn thành công',
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền xóa lịch hẹn',
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi xóa lịch hẹn',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // Get appointment by phone (Customer looking up their appointments)
    public function getByPhone($phone)
    {
        try {
            $normalizedPhone = $this->normalizePhone((string) $phone);

            $user = User::where('phone', $phone)->first();
            if (!$user) {
                $user = User::get()->first(function ($item) use ($normalizedPhone) {
                    return $this->normalizePhone($item->phone ?? '') === $normalizedPhone;
                });
            }

            if (!$user) {
                throw new \Illuminate\Database\Eloquent\ModelNotFoundException();
            }

            $appointments = Appointment::where('user_id', $user->id)
                ->with(['staff', 'services'])
                ->get();

            $appointments = $this->sortByNearestNow($appointments);

            return response()->json([
                'success' => true,
                'data' => $appointments
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy lịch hẹn với số điện thoại này'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Update appointment by phone (Public customer flow)
    public function updateByPhone(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'phone' => 'required|string|max:20',
                'appointment_date' => 'nullable|date|after:now',
                'staff_id' => 'nullable|exists:staffs,id',
                'services' => 'nullable|array|min:1',
                'services.*' => 'exists:services,id',
                'notes' => 'nullable|string'
            ], [
                'appointment_date.after' => 'Ngày hẹn phải là một thời điểm trong tương lai.',
                'services.required' => 'Vui lòng chọn ít nhất 1 dịch vụ.',
                'services.min' => 'Vui lòng chọn ít nhất 1 dịch vụ.',
                'phone.required' => 'Thiếu số điện thoại để xác thực.'
            ]);

            $appointment = Appointment::with(['user', 'services'])->findOrFail($id);

            if (!$this->canGuestAccessAppointment($appointment, $validated['phone'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Bạn không có quyền cập nhật lịch hẹn này'
                ], 403);
            }

            if (in_array($appointment->status, ['cancelled', 'completed'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể chỉnh sửa lịch đã hoàn thành hoặc đã hủy'
                ], 400);
            }

            $targetStaffId = (int) ($validated['staff_id'] ?? $appointment->staff_id);
            $targetDateTime = isset($validated['appointment_date'])
                ? Carbon::parse($validated['appointment_date'])
                : Carbon::parse($appointment->appointment_date);

            if (!$this->isWithinWorkingHours($targetDateTime)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này ngoài giờ làm việc, hãy xem lại giờ làm việc.'
                ], 422);
            }

            if ($this->isTimeSlotBooked($targetStaffId, $targetDateTime, (int) $appointment->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này đã có lịch, vui lòng chọn giờ khác.'
                ], 409);
            }

            DB::transaction(function () use ($validated, $appointment, $targetStaffId, $targetDateTime) {
                $updateData = [
                    'staff_id' => $targetStaffId,
                    'appointment_date' => $targetDateTime,
                    'status' => 'pending',
                ];

                if (array_key_exists('notes', $validated)) {
                    $updateData['notes'] = $validated['notes'];
                }

                if (isset($validated['services'])) {
                    $services = Service::whereIn('id', $validated['services'])->get();
                    $updateData['total_price'] = $services->sum('price');

                    AppointmentDetail::where('appointment_id', $appointment->id)->delete();
                    foreach ($validated['services'] as $serviceId) {
                        AppointmentDetail::create([
                            'appointment_id' => $appointment->id,
                            'service_id' => $serviceId
                        ]);
                    }
                }

                $appointment->update($updateData);
            });

            $appointment->load(['user', 'staff', 'services']);

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật lịch hẹn thành công',
                'data' => $appointment
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
                'message' => 'Lỗi khi cập nhật lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Delete appointment by phone (Public customer flow)
    public function deleteByPhone(Request $request, $id)
    {
        try {
            $validated = $request->validate([
                'phone' => 'required|string|max:20',
            ]);

            $appointment = Appointment::with('user')->findOrFail($id);

            if (!$this->canGuestAccessAppointment($appointment, $validated['phone'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Bạn không có quyền xóa lịch hẹn này'
                ], 403);
            }

            $appointment->delete();

            return response()->json([
                'success' => true,
                'message' => 'Xóa lịch hẹn thành công'
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
                'message' => 'Lỗi khi xóa lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Get my appointments (Authenticated customer)
    public function myAppointments()
    {
        try {
            $this->authorize('viewOwn', Appointment::class);

            $userId = Auth::id();

            $appointments = Appointment::where('user_id', $userId)
                ->with(['staff', 'services'])
                ->orderBy('appointment_date', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $appointments
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền xem lịch hẹn của mình'
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Update my appointment (Authenticated customer)
    public function updateMyAppointment(Request $request, $id)
    {
        try {
            $appointment = Appointment::findOrFail($id);
            $this->authorize('update', $appointment);

            $validated = $request->validate([
                'appointment_date' => 'nullable|date|after:now',
                'staff_id' => 'nullable|exists:staffs,id',
                'services' => 'nullable|array|min:1',
                'services.*' => 'exists:services,id',
                'notes' => 'nullable|string'
            ], [
                'appointment_date.after' => 'Ngày hẹn phải là một thời điểm trong tương lai.',
                'services.required' => 'Vui lòng chọn ít nhất 1 dịch vụ.',
                'services.min' => 'Vui lòng chọn ít nhất 1 dịch vụ.'
            ]);

            if (in_array($appointment->status, ['cancelled', 'completed'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể chỉnh sửa lịch đã hoàn thành hoặc đã hủy'
                ], 400);
            }

            $targetStaffId = (int) ($validated['staff_id'] ?? $appointment->staff_id);
            
            // Explicitly parse with the app timezone to be safe
            $targetDateTime = isset($validated['appointment_date'])
                ? Carbon::parse($validated['appointment_date'], config('app.timezone'))
                : Carbon::parse($appointment->appointment_date, config('app.timezone'));

            \Illuminate\Support\Facades\Log::info('Updating appointment (Authenticated)', [
                'id' => $id,
                'input_date' => $validated['appointment_date'] ?? 'not provided',
                'parsed_date' => $targetDateTime->format('Y-m-d H:i:s'),
                'timezone' => config('app.timezone')
            ]);

            if (!$this->isWithinWorkingHours($targetDateTime)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này ngoài giờ làm việc, hãy xem lại giờ làm việc.'
                ], 422);
            }

            if ($this->isTimeSlotBooked($targetStaffId, $targetDateTime, (int) $appointment->id)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Khung giờ này đã có lịch, vui lòng chọn giờ khác.'
                ], 409);
            }

            DB::transaction(function () use ($validated, $appointment, $targetStaffId, $targetDateTime) {
                $updateData = [
                    'staff_id' => $targetStaffId,
                    'appointment_date' => $targetDateTime,
                    'status' => 'pending',
                ];

                if (array_key_exists('notes', $validated)) {
                    $updateData['notes'] = $validated['notes'];
                }

                if (isset($validated['services'])) {
                    $services = Service::whereIn('id', $validated['services'])->get();
                    $updateData['total_price'] = $services->sum('price');

                    AppointmentDetail::where('appointment_id', $appointment->id)->delete();
                    foreach ($validated['services'] as $serviceId) {
                        AppointmentDetail::create([
                            'appointment_id' => $appointment->id,
                            'service_id' => $serviceId
                        ]);
                    }
                }

                $appointment->update($updateData);
            });

            $appointment->load(['user', 'staff', 'services']);

            return response()->json([
                'success' => true,
                'message' => 'Cập nhật lịch hẹn thành công',
                'data' => $appointment
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền cập nhật lịch hẹn này'
            ], 403);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Dữ liệu không hợp lệ',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi cập nhật lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Delete my appointment (Authenticated customer)
    public function deleteMyAppointment($id)
    {
        try {
            $appointment = Appointment::findOrFail($id);
            $this->authorize('update', $appointment); // Using update policy for deletion as well

            $appointment->delete();

            return response()->json([
                'success' => true,
                'message' => 'Xóa lịch hẹn thành công'
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền xóa lịch hẹn này'
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi xóa lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Confirm appointment (Admin)
    public function confirm($id)
    {
        try {
            $this->authorize('manage', Appointment::class);

            $appointment = Appointment::findOrFail($id);
            $appointment->update(['status' => 'confirmed']);

            return response()->json([
                'success' => true,
                'message' => 'Lịch hẹn được xác nhận thành công',
                'data' => $appointment
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền xác nhận lịch hẹn'
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi xác nhận lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Reject appointment (Admin)
    public function reject($id)
    {
        try {
            $this->authorize('manage', Appointment::class);

            $appointment = Appointment::findOrFail($id);
            $appointment->update(['status' => 'rejected']);

            return response()->json([
                'success' => true,
                'message' => 'Lịch hẹn được từ chối thành công',
                'data' => $appointment
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền từ chối lịch hẹn'
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi từ chối lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Reschedule appointment (Admin)
    public function reschedule(Request $request, $id)
    {
        try {
            $this->authorize('manage', Appointment::class);

            $validated = $request->validate([
                'appointment_date' => 'required|date|after:today'
            ]);

            $appointment = Appointment::findOrFail($id);
            $appointment->update(['appointment_date' => $validated['appointment_date']]);

            return response()->json([
                'success' => true,
                'message' => 'Lịch hẹn được dời thành công',
                'data' => $appointment
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền dời lịch hẹn'
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi dời lịch hẹn',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    // Update appointment status (Admin)
    public function updateStatus(Request $request, $id)
    {
        try {
            $this->authorize('manage', Appointment::class);

            $validated = $request->validate([
                'status' => 'required|in:pending,confirmed,in-process,completed,cancelled,no-show'
            ]);

            $appointment = Appointment::findOrFail($id);
            $appointment->update(['status' => $validated['status']]);

            return response()->json([
                'success' => true,
                'message' => 'Trạng thái lịch hẹn được cập nhật thành công',
                'data' => $appointment
            ]);
        } catch (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không có quyền cập nhật trạng thái lịch hẹn'
            ], 403);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi cập nhật trạng thái',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
