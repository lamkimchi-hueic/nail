<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UsersSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Default admin for fresh online deployments.
        $admin = User::updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Default Admin',
                'email' => 'admin@nail.local',
                'phone' => '0123456789',
                'password' => Hash::make('123456'),
                'role' => 'admin'
            ]
        );
        $admin->syncRoles(['admin']);
        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) {
            $admin->syncPermissions($adminRole->permissions);
        }

        // Create customer users
        $customer1 = User::firstOrCreate(
            ['username' => 'customer1'],
            [
                'phone' => '0987654321',
                'password' => Hash::make('password'),
                'role' => 'customer'
            ]
        );
        $customer1->syncRoles(['customer']);

        $customer2 = User::firstOrCreate(
            ['username' => 'customer2'],
            [
                'phone' => '0912345678',
                'password' => Hash::make('password'),
                'role' => 'customer'
            ]
        );
        $customer2->syncRoles(['customer']);

        $this->command->info('✓ Users created and roles assigned');
        $this->command->info('✓ Default admin: admin / 123456');
    }
}
