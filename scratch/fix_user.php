<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = \App\Models\User::find(20);
if ($user) {
    $user->username = 'lkc24th';
    $user->password = \Illuminate\Support\Facades\Hash::make('123456');
    $user->save();
    echo "User ID 20 updated successfully: username='lkc24th', password='123456'\n";
} else {
    echo "User ID 20 not found.\n";
}
