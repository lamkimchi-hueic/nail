<?php

namespace App\Scripts;

use App\Http\Controllers\SalonSettingController;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class TestUpload {
    public static function run() {
        $file = UploadedFile::fake()->image('test.jpg');
        $request = new Request();
        $request->files->set('image', $file);
        $request->merge(['type' => 'hero_image']);
        $controller = new SalonSettingController();
        $res = $controller->uploadImage($request);
        return $res->getContent();
    }
}

echo TestUpload::run();
