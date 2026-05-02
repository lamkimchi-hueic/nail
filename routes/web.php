<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/test-route', function() {
    return "WEB ROUTE WORKING";
});

Route::get('/api/health-check', function () {
    return response()->json(['status' => 'ok', 'message' => 'API WORKING FROM WEB.PHP']);
});

// Route::get('/{any}', function () {
//     return view('welcome');
// })->where('any', '^(?!api).*$');
