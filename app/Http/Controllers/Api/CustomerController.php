<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        try {
            $perPage = (int) $request->get('per_page', 15);
            $perPage = $perPage > 0 ? min($perPage, 100) : 15;

            $query = User::query()
                ->where(function ($builder) {
                    $builder->where('role', 'customer')
                        ->orWhereNull('role');
                })
                ->withCount('appointments')
                ->orderByDesc('id');

            if ($request->filled('search')) {
                $search = trim((string) $request->get('search'));
                $query->where(function ($builder) use ($search) {
                    $builder->where('username', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            }

            $customers = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $customers->items(),
                'pagination' => [
                    'total' => $customers->total(),
                    'per_page' => $customers->perPage(),
                    'current_page' => $customers->currentPage(),
                    'last_page' => $customers->lastPage(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy danh sách khách hàng',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return response()->json([
            'success' => false,
            'message' => 'Method not allowed'
        ], 405);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        return response()->json([
            'success' => false,
            'message' => 'Method not allowed'
        ], 405);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        try {
            $customer = User::where(function ($builder) {
                $builder->where('role', 'customer')
                    ->orWhereNull('role');
            })->findOrFail($id);

            $appointments = Appointment::where('user_id', $customer->id)
                ->with(['staff', 'services'])
                ->orderByDesc('appointment_date')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'customer' => $customer,
                    'appointments' => $appointments,
                    'total_appointments' => $appointments->count(),
                    'total_spent' => $appointments->sum('total_price'),
                ],
            ]);
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Khách hàng không tìm thấy',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi lấy thông tin khách hàng',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Method not allowed'
        ], 405);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Method not allowed'
        ], 405);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Method not allowed'
        ], 405);
    }

    public function search(string $query)
    {
        try {
            $query = trim($query);

            if (mb_strlen($query) < 2) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tìm kiếm phải chứa ít nhất 2 ký tự',
                ], 400);
            }

            $customers = User::query()
                ->where(function ($builder) {
                    $builder->where('role', 'customer')
                        ->orWhereNull('role');
                })
                ->where(function ($builder) use ($query) {
                    $builder->where('username', 'like', "%{$query}%")
                        ->orWhere('email', 'like', "%{$query}%")
                        ->orWhere('phone', 'like', "%{$query}%");
                })
                ->withCount('appointments')
                ->limit(20)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $customers,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi tìm kiếm khách hàng',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}