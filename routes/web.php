<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

Route::get('/', function () {
    return view('welcome');
});

// Fallback route cho SPA
Route::fallback(function (Request $request) {
    // Nếu là request API mà không khớp route nào, trả về 404 JSON
    if ($request->is('api/*')) {
        return response()->json(['error' => 'API Route not found'], 404);
    }
    // Còn lại trả về trang chủ React
    return view('welcome');
});
