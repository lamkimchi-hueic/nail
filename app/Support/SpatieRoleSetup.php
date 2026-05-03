<?php

namespace App\Support;

use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class SpatieRoleSetup
{
    public static function ensure(): void
    {
        app()['cache']->forget('spatie.permission.cache');

        $permissions = [
            'view_services',
            'create_services',
            'edit_services',
            'delete_services',
            'view_appointments',
            'view_all_appointments',
            'create_appointments',
            'edit_appointments',
            'confirm_appointments',
            'reject_appointments',
            'cancel_appointments',
            'reschedule_appointments',
            'change_appointment_status',
            'view_customers',
            'view_customer_details',
            'search_customers',
            'view_settings',
            'edit_settings',
            'manage_staff',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $adminRole->syncPermissions(Permission::where('guard_name', 'web')->get());

        $customerRole = Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
        $customerRole->syncPermissions([
            'view_services',
            'create_appointments',
            'view_appointments',
            'cancel_appointments',
        ]);
    }
}
