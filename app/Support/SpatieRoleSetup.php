<?php

namespace App\Support;

use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class SpatieRoleSetup
{
    public static function ensure(): void
    {
        $permissions = self::permissions();
        $customerPermissions = self::customerPermissions();

        $adminRole = Role::where('name', 'admin')->where('guard_name', 'web')->first();
        $customerRole = Role::where('name', 'customer')->where('guard_name', 'web')->first();
        $permissionCount = Permission::where('guard_name', 'web')
            ->whereIn('name', $permissions)
            ->count();

        if (
            $adminRole
            && $customerRole
            && $permissionCount === count($permissions)
            && $customerRole->permissions()->whereIn('name', $customerPermissions)->count() === count($customerPermissions)
        ) {
            return;
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        if ($adminRole->permissions()->count() !== count($permissions)) {
            $adminRole->syncPermissions(Permission::where('guard_name', 'web')->get());
        }

        $customerRole = Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
        if ($customerRole->permissions()->whereIn('name', $customerPermissions)->count() !== count($customerPermissions)) {
            $customerRole->syncPermissions($customerPermissions);
        }
    }

    private static function permissions(): array
    {
        return [
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
    }

    private static function customerPermissions(): array
    {
        return [
            'view_services',
            'create_appointments',
            'view_appointments',
            'cancel_appointments',
        ];
    }
}
