<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/env.php';

/**
 * High-Security AES-256-GCM Two-Way Encryption Service
 * Used for encrypting device credentials (MikroTik passwords, OLT Telnet/SSH, SNMP Community)
 * Compliant with PRD Section 5.
 */
final class CryptoService
{
    private static string $cipher = 'aes-256-gcm';

    private static function getKey(): string
    {
        $hexKey = (string)env('APP_KEY', '');
        if (strlen($hexKey) === 64) {
            $key = hex2bin($hexKey);
            if ($key !== false && strlen($key) === 32) {
                return $key;
            }
        }

        // Fallback SHA-256 if hex format is shorter
        return hash('sha256', $hexKey !== '' ? $hexKey : 'default_fallback_insecure_key_change_me', true);
    }

    /**
     * Encrypt plaintext string with AES-256-GCM
     * Format output: base64(iv:12 bytes + tag:16 bytes + ciphertext)
     */
    public static function encrypt(string $plaintext): string
    {
        $key = self::getKey();
        $ivLength = openssl_cipher_iv_length(self::$cipher);
        $iv = random_bytes($ivLength);
        $tag = '';

        $ciphertext = openssl_encrypt(
            $plaintext,
            self::$cipher,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            16
        );

        if ($ciphertext === false) {
            throw new RuntimeException("Failed to encrypt data using AES-256-GCM");
        }

        return base64_encode($iv . $tag . $ciphertext);
    }

    /**
     * Decrypt base64-encoded AES-256-GCM ciphertext
     */
    public static function decrypt(string $payload): ?string
    {
        $data = base64_decode($payload, true);
        if ($data === false) {
            return null;
        }

        $ivLength = openssl_cipher_iv_length(self::$cipher);
        $tagLength = 16;

        if (strlen($data) < ($ivLength + $tagLength)) {
            return null;
        }

        $iv = substr($data, 0, $ivLength);
        $tag = substr($data, $ivLength, $tagLength);
        $ciphertext = substr($data, $ivLength + $tagLength);

        $key = self::getKey();
        $plaintext = openssl_decrypt(
            $ciphertext,
            self::$cipher,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        return $plaintext !== false ? $plaintext : null;
    }
}
