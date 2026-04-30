<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tokens = DB::table('personal_access_tokens')->orderBy('created_at', 'desc')->limit(10)->get();
foreach ($tokens as $token) {
    echo "ID: {$token->id}, Tokenable ID: {$token->tokenable_id}, Created: {$token->created_at}\n";
}
