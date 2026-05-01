<?php
use App\Http\Controllers\SalonSettingController;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Simulate a request
$file = UploadedFile::fake()->image('test.jpg');
$request = Request::create('/api/salon-settings/upload-image', 'POST', [
    'type' => 'hero_image'
], [], ['image' => $file]);

$controller = new SalonSettingController();
$response = $controller->uploadImage($request);

echo $response->getContent();
