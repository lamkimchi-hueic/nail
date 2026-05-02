<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/backend/health-check', function () {
    return response()->json(['status' => 'ok', 'message' => 'API WORKING FROM WEB.PHP']);
});

// Fallback route cho SPA
Route::fallback(function (Request $request) {
    // Nếu là request API mà không khớp route nào, trả về 404 JSON
    if ($request->is('backend/*')) {
        return response()->json(['error' => 'API Route not found', 'path' => $request->path()], 404);
    }
    // Còn lại trả về trang chủ React
    return view('welcome');
});
