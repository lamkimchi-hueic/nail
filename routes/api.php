<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\SalonSettingController;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\OAuthController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\UserController;

// OAuth routes
Route::get('/auth/google', [OAuthController::class, 'redirectToGoogle'])->name('google.redirect');
Route::get('/auth/google/callback', [OAuthController::class, 'handleGoogleCallback'])->name('google.callback');
Route::post('/auth/google/complete', [OAuthController::class, 'completeRegistration'])->name('google.complete');

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');

// Unauthenticated public routes
Route::get('/services', [ServiceController::class, 'index']);
Route::get('/services/{id}', [ServiceController::class, 'show']);
Route::get('/salon-settings/public', [SalonSettingController::class, 'publicSettings']);
Route::get('/staffs', [StaffController::class, 'index']);
Route::get('/staffs/{id}', [StaffController::class, 'show']);

// Customer booking routes (public info)
Route::get('/appointments/schedule', [AppointmentController::class, 'publicSchedule']);

// Get available slots for a staff (public)
Route::get('/staffs/{id}/available-slots', [StaffController::class, 'availableSlots']);

// Authenticated routes
Route::middleware(['auth:sanctum'])->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Customer - Appointments
    Route::post('/appointments', [AppointmentController::class, 'store']);
    Route::get('/my-appointments', [AppointmentController::class, 'myAppointments']);
    Route::put('/my-appointments/{id}', [AppointmentController::class, 'updateMyAppointment']);
    Route::delete('/my-appointments/{id}', [AppointmentController::class, 'deleteMyAppointment']);

    // Admin - Services management
    Route::middleware(['role:admin'])->group(function () {
        Route::post('/services', [ServiceController::class, 'store']);
        Route::put('/services/{id}', [ServiceController::class, 'update']);
        Route::delete('/services/{id}', [ServiceController::class, 'destroy']);
    });

    // Admin - Staff management
    Route::middleware(['role:admin', 'permission:manage_staff'])->group(function () {
        Route::post('/staffs', [StaffController::class, 'store']);
        Route::put('/staffs/{id}', [StaffController::class, 'update']);
        Route::delete('/staffs/{id}', [StaffController::class, 'destroy']);
    });

    // Admin - Appointments management (require admin role + permission)
    Route::middleware(['role:admin', 'permission:view_all_appointments'])->group(function () {
        Route::get('/appointments', [AppointmentController::class, 'index']);
        Route::post('/appointments/create-manual', [AppointmentController::class, 'createManual']);
        Route::put('/appointments/{id}/admin', [AppointmentController::class, 'adminUpdate']);
        Route::delete('/appointments/{id}/admin', [AppointmentController::class, 'adminDelete']);
        Route::patch('/appointments/{id}/confirm', [AppointmentController::class, 'confirm']);
        Route::patch('/appointments/{id}/reject', [AppointmentController::class, 'reject']);
        Route::patch('/appointments/{id}/reschedule', [AppointmentController::class, 'reschedule']);
        Route::patch('/appointments/{id}/status', [AppointmentController::class, 'updateStatus']);
        Route::get('/appointments/date-range', [AppointmentController::class, 'getByDateRange']);
    });

    // Admin - Customers management (require admin role + permission)
    Route::middleware(['role:admin', 'permission:view_customers'])->group(function () {
        Route::get('/customers', [CustomerController::class, 'index']);
        Route::get('/customers/{id}', [CustomerController::class, 'show']);
        Route::get('/customers/search/{query}', [CustomerController::class, 'search']);
    });

    // Admin - User management
    Route::middleware(['role:admin'])->group(function () {
        // Keeping both AdminUserController and UserController as they might serve different purposes or be in transition
        Route::get('/admin/users', [AdminUserController::class, 'index']);
        Route::post('/admin/users', [AdminUserController::class, 'store']);
        Route::put('/admin/users/{id}', [AdminUserController::class, 'update']);
        Route::delete('/admin/users/{id}', [AdminUserController::class, 'destroy']);
        
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
        Route::get('/roles', [UserController::class, 'roles']);
    });
});

// Admin - Salon settings management
Route::get('/salon-settings', [SalonSettingController::class, 'index']);
Route::put('/salon-settings', [SalonSettingController::class, 'update']);
Route::post('/salon-settings/upload-image', [SalonSettingController::class, 'uploadImage']);
Route::delete('/salon-settings/delete-image', [SalonSettingController::class, 'deleteImage']);
