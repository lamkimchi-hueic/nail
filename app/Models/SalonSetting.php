<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SalonSetting extends Model
{
    protected $fillable = ['key', 'value'];

    protected $casts = [
        'value' => 'json',
    ];
}
