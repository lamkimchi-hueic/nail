<?php

// Chuyển hướng các yêu cầu file tĩnh (ảnh, css, js...) vào thư mục public
if (is_file(__DIR__ . '/../public' . $_SERVER['REQUEST_URI'])) {
    return false;
}

// Cấu hình cho Vercel (môi trường read-only, chỉ /tmp cho phép ghi)
// Dùng putenv() để Laravel đọc được qua env()
putenv('APP_ENV=production');
putenv('APP_DEBUG=false');
putenv('VIEW_COMPILED_PATH=/tmp/views');
putenv('APP_CONFIG_CACHE=/tmp/config.php');
putenv('APP_ROUTES_CACHE=/tmp/routes.php');
putenv('APP_PACKAGES_CACHE=/tmp/packages.php');
putenv('APP_SERVICES_CACHE=/tmp/services.php');
putenv('APP_EVENTS_CACHE=/tmp/events.php');
putenv('LOG_CHANNEL=stderr');
putenv('SESSION_DRIVER=cookie');
putenv('CACHE_STORE=array');

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
