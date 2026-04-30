<?php

namespace App\Policies;

use App\Models\Appointment;
use App\Models\User;

class AppointmentPolicy
{
    public function viewAny(User $user): bool
    {
        // Allow admins to view all appointments
        // They should inherit view_all_appointments permission from admin role
        return $user->hasRole('admin');
    }

    public function viewOwn(User $user): bool
    {
        return $user->hasRole('customer') || $user->hasRole('admin');
    }

    public function create(User $user): bool
    {
        return $user->hasRole('admin') && $user->can('view_all_appointments');
    }

    public function manage(User $user): bool
    {
        return $user->hasRole('admin') && $user->can('view_all_appointments');
    }

    public function cancel(User $user, Appointment $appointment): bool
    {
        return $appointment->user_id === $user->id
            || ($user->hasRole('admin') && $user->can('view_all_appointments'));
    }

    public function update(User $user, Appointment $appointment): bool
    {
        return $appointment->user_id === $user->id
            || ($user->hasRole('admin') && $user->can('view_all_appointments'));
    }
}
