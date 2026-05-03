<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class () extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('services') || !Schema::hasColumn('services', 'image')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE services ALTER COLUMN image TYPE TEXT');
            return;
        }

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE services MODIFY image LONGTEXT NULL');
            return;
        }

        if ($driver === 'sqlite') {
            return;
        }

        Schema::table('services', function ($table) {
            $table->longText('image')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('services') || !Schema::hasColumn('services', 'image')) {
            return;
        }

        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE services ALTER COLUMN image TYPE VARCHAR(255)');
            return;
        }

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE services MODIFY image VARCHAR(255) NULL');
        }
    }
};
