#!/usr/bin/env sh
set -eu

lan_ip="${1:?Usage: ./scripts/generate-lan-tls.sh <server-lan-ip> [output-directory]}"
output_dir="${2:-infra/tls}"

umask 077
mkdir -p "$output_dir"

openssl req -x509 -nodes -newkey rsa:2048 -sha256 -days 825 \
  -keyout "$output_dir/ws3-lan.key" \
  -out "$output_dir/ws3-lan.crt" \
  -subj "/CN=$lan_ip" \
  -addext "subjectAltName=IP:$lan_ip" \
  -addext "extendedKeyUsage=serverAuth"

chmod 600 "$output_dir/ws3-lan.key"
printf '%s\n' "Created $output_dir/ws3-lan.crt and $output_dir/ws3-lan.key"
