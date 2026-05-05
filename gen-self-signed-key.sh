# If ca_key is an RSA key:
openssl req -new -x509 -days 3650 -key signing-keys/ca_key \
  -out signing-keys/ca_cert.pem \
  -subj "/CN=registry-auth"

# Verify it works
openssl x509 -in signing-keys/ca_cert.pem -text -noout | head -20