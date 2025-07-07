-- Manually insert OAuth tokens for testing
INSERT INTO oauth_tokens (
    client_id,
    client_id_hash,
    encrypted_tokens,
    last_refreshed_at,
    refresh_count
) VALUES (
    '1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU',
    encode(sha256('1000.U38EZ7R0KMO9DQZHYGKE83FG4OVUEU'::bytea), 'hex'),
    '{"accessToken":"","refreshToken":"1000.230f6615807edcbeb20dbe397b50e836.635ca41b7d8dd576174f07ea1232ef7d","expiresAt":"2025-01-01T00:00:00.000Z"}',
    NOW(),
    0
);
EOF < /dev/null