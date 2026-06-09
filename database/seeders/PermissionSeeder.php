<?php

namespace Database\Seeders;

use App\Support\SpatieRoleSetup;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run()
    {
        SpatieRoleSetup::ensure();
        $this->command->info('✓ Roles and permissions created successfully');
    }
}
