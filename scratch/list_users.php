<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$users = \App\Models\User::where('username', 'like', '%lkc%')
    ->orWhere('name', 'like', '%lkc%')
    ->orWhere('email', 'like', '%lkc%')
    ->get();
if ($users->isEmpty()) {
    echo "No users found matching 'lkc'\n";
    $all = \App\Models\User::all();
    echo "Total users in database: " . $all->count() . "\n";
} else {
    foreach ($users as $user) {
        echo "ID: {$user->id}, Username: {$user->username}, Name: {$user->name}, Phone: {$user->phone}, Email: {$user->email}, Created: {$user->created_at}\n";
    }
}
