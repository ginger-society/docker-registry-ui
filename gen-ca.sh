# Generate new EC P-256 key (smaller and faster than RSA, supported by registry)
mkdir -p signing-keys

openssl ecparam -name prime256v1 -genkey -noout -out signing-keys/auth.key

# Generate the self-signed cert from it (this is what registry mounts)
openssl req -new -x509 -days 3650 \
  -key signing-keys/auth.key \
  -out signing-keys/auth.cert \
  -subj "/CN=registry-auth"

# Verify both look correct
echo "=== Private Key ===" && head -3 signing-keys/auth.key
echo "=== Certificate ===" && head -3 signing-keys/auth.cert
openssl x509 -in signing-keys/auth.cert -text -noout | grep -E "Subject:|Public Key Algorithm:|Not"