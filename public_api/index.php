<?php

// Chuyển hướng các yêu cầu file tĩnh
if (is_file(__DIR__ . '/../public' . $_SERVER['REQUEST_URI'])) {
    return false;
}

// Fix cho Vercel: Đảm bảo REQUEST_URI và SCRIPT_NAME đồng nhất
// Nếu Vercel chạy qua route rewrite, REQUEST_URI thường giữ nguyên, 
// nhưng Laravel cần biết file thực thi đang ở đâu.
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/index.php';

// Force HTTPS
$_SERVER['HTTPS'] = 'on';
$_SERVER['SERVER_PORT'] = 443;

// Env config
putenv('APP_ENV=production');
putenv('APP_DEBUG=false');
putenv('APP_URL=https://nail-amber.vercel.app');
putenv('VIEW_COMPILED_PATH=/tmp/views');
putenv('APP_CONFIG_CACHE=/tmp/config.php');
putenv('APP_ROUTES_CACHE=/tmp/routes.php');
putenv('APP_PACKAGES_CACHE=/tmp/packages.php');
putenv('APP_SERVICES_CACHE=/tmp/services.php');
putenv('APP_EVENTS_CACHE=/tmp/events.php');
putenv('LOG_CHANNEL=stderr');
putenv('SESSION_DRIVER=cookie');
putenv('CACHE_STORE=array');

if (!is_dir('/tmp/views')) {
    mkdir('/tmp/views', 0755, true);
}

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

// QUAN TRỌNG: Ép Laravel sử dụng đúng URI từ SERVER
$request = Illuminate\Http\Request::capture();
$response = $kernel->handle($request);
$response->send();
$kernel->terminate($request, $response);
