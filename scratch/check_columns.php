<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$columns = DB::select('SHOW COLUMNS FROM users');
foreach ($columns as $column) {
    print_r($column);
}
