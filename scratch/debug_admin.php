<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$admin = App\Models\User::where('role', 'admin')->first();
echo "Admin user: ID={$admin->id}, Name={$admin->name}, Email={$admin->email}\n";
echo "Has admin role (Spatie): " . ($admin->hasRole('admin') ? 'YES' : 'NO') . "\n";
echo "Has view_all_appointments permission: " . ($admin->can('view_all_appointments') ? 'YES' : 'NO') . "\n";

// Check tokens
$tokens = $admin->tokens()->orderBy('id', 'desc')->limit(3)->get();
echo "\nLatest tokens:\n";
foreach ($tokens as $t) {
    echo "  Token ID: {$t->id}, Created: {$t->created_at}\n";
}

// Check staffs table
$staffCount = \App\Models\Staff::count();
echo "\nStaff count: {$staffCount}\n";
$staff1 = \App\Models\Staff::find(1);
echo "Staff #1 exists: " . ($staff1 ? "YES - {$staff1->name}" : "NO") . "\n";

// Test createManual validation by simulating request
echo "\n--- Simulating createManual ---\n";
try {
    $token = $admin->createToken('debug-test')->plainTextToken;
    echo "Created test token: " . substr($token, 0, 20) . "...\n";
    
    $url = 'http://127.0.0.1:8000/api/appointments/create-manual';
    $data = json_encode([
        'name' => 'Test User',
        'phone' => '0123456789',
        'staff_id' => 1,
        'appointment_date' => date('Y-m-d', strtotime('+1 day')) . ' 10:00:00',
        'services' => [1],
        'notes' => 'Test from debug script'
    ]);
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json',
        'Authorization: Bearer ' . $token
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    echo "HTTP Status: {$httpCode}\n";
    echo "Response: {$response}\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
