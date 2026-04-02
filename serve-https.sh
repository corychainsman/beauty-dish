#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="$ROOT_DIR/.certs"
CERT_FILE="$CERT_DIR/dev-cert.pem"
KEY_FILE="$CERT_DIR/dev-key.pem"
PORT="${PORT:-8443}"

if ! command -v mkcert >/dev/null 2>&1; then
	echo "mkcert is required. Install it with: brew install mkcert nss"
	exit 1
fi

if command -v http-server >/dev/null 2>&1; then
	HTTP_SERVER_CMD=(http-server)
elif command -v npx >/dev/null 2>&1; then
	HTTP_SERVER_CMD=(npx --yes http-server)
else
	echo "http-server is required. Install it with: npm install -g http-server"
	exit 1
fi

LOCAL_HOSTNAME="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
LOCAL_HOSTNAME_LOWER="$(printf '%s' "$LOCAL_HOSTNAME" | tr '[:upper:]' '[:lower:]')"

mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
	echo "Generating local HTTPS certificate in $CERT_DIR"
	mkcert -install >/dev/null
	mkcert \
		-cert-file "$CERT_FILE" \
		-key-file "$KEY_FILE" \
		localhost \
		127.0.0.1 \
		::1 \
		"$LOCAL_HOSTNAME" \
		"$LOCAL_HOSTNAME_LOWER"
fi

echo "Serving $ROOT_DIR over HTTPS"
echo "Open one of:"
echo "  https://localhost:$PORT"
echo "  https://$LOCAL_HOSTNAME_LOWER:$PORT"

cd "$ROOT_DIR"
"${HTTP_SERVER_CMD[@]}" . \
	-a 0.0.0.0 \
	-p "$PORT" \
	-S \
	-C "$CERT_FILE" \
	-K "$KEY_FILE"
