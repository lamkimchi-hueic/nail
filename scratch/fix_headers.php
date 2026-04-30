<?php
$content = file_get_contents('resources/js/app.jsx');
$adminPanelStart = strpos($content, 'function AdminPanel');
$adminPanelEnd = strpos($content, 'function PublicHome');

$adminPanelContent = substr($content, $adminPanelStart, $adminPanelEnd - $adminPanelStart);

$adminPanelContent = preg_replace('/headers:\s*\{\s*Accept:\s*\'application\/json\'\s*\}/', 'headers: getAuthHeaders()', $adminPanelContent);
$adminPanelContent = preg_replace('/headers:\s*\{\s*\'Content-Type\':\s*\'application\/json\',\s*Accept:\s*\'application\/json\'\s*\}/', 'headers: getAuthHeaders({ \'Content-Type\': \'application/json\' })', $adminPanelContent);

$newContent = substr_replace($content, $adminPanelContent, $adminPanelStart, $adminPanelEnd - $adminPanelStart);
file_put_contents('resources/js/app.jsx', $newContent);
echo "Replaced headers in AdminPanel\n";
