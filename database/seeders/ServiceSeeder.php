<?php

namespace Database\Seeders;

use App\Models\Service;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ServiceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $services = [
            [
                'name' => 'Manicure cơ bản',
                'price' => 180000,
                'duration' => 45,
                'description' => 'Cắt da, tạo form móng và sơn dưỡng nhẹ nhàng.',
            ],
            [
                'name' => 'Gel màu cao cấp',
                'price' => 320000,
                'duration' => 60,
                'description' => 'Sơn gel bền màu với bảng màu theo mùa.',
            ],
            [
                'name' => 'Nail art theo mẫu',
                'price' => 450000,
                'duration' => 90,
                'description' => 'Thiết kế móng theo hình ảnh hoặc phong cách riêng.',
            ],
            [
                'name' => 'Pedicure thư giãn',
                'price' => 280000,
                'duration' => 60,
                'description' => 'Chăm sóc móng chân kết hợp ngâm thư giãn.',
            ],
        ];

        foreach ($services as $service) {
            Service::firstOrCreate(
                ['name' => $service['name']],
                $service + ['is_active' => true]
            );
        }
    }
}
