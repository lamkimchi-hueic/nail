<?php

// Chuyển hướng các yêu cầu file tĩnh (ảnh, css, js...) vào thư mục public
if (file_exists(__DIR__ . '/../public' . $_SERVER['REQUEST_URI'])) {
    return false;
}

// Cấu hình đường dẫn tạm cho Vercel (môi trường read-only, chỉ /tmp cho phép ghi)
$_ENV['APP_ENV'] = 'production';
$_ENV['APP_DEBUG'] = 'false';
$_ENV['VIEW_COMPILED_PATH'] = '/tmp/views';
$_ENV['APP_CONFIG_CACHE'] = '/tmp/config.php';
$_ENV['APP_ROUTES_CACHE'] = '/tmp/routes.php';
$_ENV['APP_PACKAGES_CACHE'] = '/tmp/packages.php';
$_ENV['APP_SERVICES_CACHE'] = '/tmp/services.php';
$_ENV['APP_EVENTS_CACHE'] = '/tmp/events.php';
$_ENV['LOG_CHANNEL'] = 'stderr';
$_ENV['SESSION_DRIVER'] = 'cookie';
$_ENV['CACHE_STORE'] = 'array';

// Tạo thư mục views tạm nếu chưa tồn tại
if (!is_dir('/tmp/views')) {
    mkdir('/tmp/views', 0755, true);
}

// Đường dẫn trỏ đến file autoload.php trong thư mục vendor
require __DIR__ . '/../vendor/autoload.php';

// Đường dẫn trỏ đến file app.php trong thư mục bootstrap
$app = require_once __DIR__ . '/../bootstrap/app.php';

// Khởi tạo kernel và xử lý yêu cầu
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$response = $kernel->handle(
    $request = Illuminate\Http\Request::capture()
);

$response->send();

$kernel->terminate($request, $response);
