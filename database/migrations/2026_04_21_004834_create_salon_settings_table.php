<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class () extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('salon_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // e.g., 'hero_image'
            $table->longText('value')->nullable(); // json or path
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('salon_settings');
    }
};
