<?php
$file = __DIR__ . '/../resources/js/app.jsx';
$lines = file($file);

echo "=== BEFORE FIX (lines 1279-1292) ===\n";
for ($i = 1278; $i <= 1291; $i++) {
    echo ($i+1) . ': ' . rtrim($lines[$i]) . "\n";
}

// Problem: The apt card <div key={apt.id}> from line 1185 is never closed.
// After line 1281 "                                  )}" (closes editingAppointmentId conditional)
// we need "</div>" to close the apt card div before the return ")" on line 1282.

// Also remove the extra </div> at line 1285 that was wrongly closing the apt card.
// The structure should be:
//   L1280: </div>   closes edit form div (L1215)
//   L1281: )}       closes editingAppointmentId conditional (L1214)
//   NEW:   </div>   closes apt card div (L1185)
//   L1282: )        closes return
//   L1283: })       closes map callback  
//   L1284: )}       closes ternary
//   L1285: </div>   closes space-y-3 div (L1177) -- currently EXTRA, was closing L1185

// Insert </div> after line 1281 (0-indexed 1280)
$insertLine = "                              </div>\r\n";
array_splice($lines, 1281, 0, [$insertLine]);

// Now the old line 1285 (which was extra </div>) is now at index 1286.
// Remove it (0-indexed 1286)
// Actually, wait - let me not remove it. Let me check after the fix.
// The extra </div> at old line 1285 (now 1286) should close the space-y-3 div (L1177).
// Let me trace:
// After insert:
// L1282: NEW </div> closes apt card (L1185)
// L1283: ) closes return
// L1284: }) closes map callback
// L1285: )} closes ternary
// L1286: </div> (old 1285) closes space-y-3 div (L1177)
// L1287: </div> (old 1286) closes lookup content div (L1155)
// L1288: )} closes showLookupSection conditional
// L1289: </div> closes mt-4 div (L1144)
// L1290: )} closes auth?.user conditional
// L1291: </div> closes rounded-xl div (L898)
// L1292: </aside>

echo "\n=== AFTER FIX (lines 1279-1293) ===\n";
for ($i = 1278; $i <= 1292; $i++) {
    echo ($i+1) . ': ' . rtrim($lines[$i]) . "\n";
}

file_put_contents($file, implode('', $lines));
echo "\nFile saved successfully.\n";
