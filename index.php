<?php
declare(strict_types=1);

/**
 * NMS-GIS ISP - Root Entry Proxy
 * Forwards all web requests to public/index.php for Shared Hosting, cPanel, and Hostinger hPanel.
 */

require_once __DIR__ . '/public/index.php';
