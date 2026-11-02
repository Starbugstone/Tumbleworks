#!/usr/bin/env bash
# Builds the tracked and new files with the real hosting controller, serves the release
# with Apache and checks what a player's browser receives. Needs PHP, Node and Docker.
set -euo pipefail
cd "$(dirname "$0")/../.."

work=$(mktemp -d)
root="$work/root"
source_dir="$work/source"
network="tumbleworks-site-test-$$"
site="$network-apache"
port=${SITE_TEST_PORT:-18080}
base="http://127.0.0.1:$port"
cleanup() {
  docker rm -f "$site" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  chmod -R u+rwX "$work" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$root" "$source_dir"
git ls-files -coz --exclude-standard | tar --null -T - -cf - | tar -xf - -C "$source_dir"
git -C "$source_dir" init -q
git -C "$source_dir" add .
git -C "$source_dir" -c user.name='Site Test' -c user.email=test@localhost -c commit.gpgsign=false commit -qm 'Disposable test source'
sha=$(git -C "$source_dir" rev-parse HEAD)
id="$sha-20261101000000-aaaaaaaa"

php tests/o2switch/site-build.php build "$source_dir" "$root" "$id" || { tail -n 40 "$root/logs/control.log"; exit 1; }
public="$root/releases/$id/public"

fail() { echo "FAIL: $*" >&2; exit 1; }
[[ -s "$public/index.html" && -s "$public/release.txt" ]] || fail 'release is missing its page or marker'
cmp -s public/.htaccess "$public/.htaccess" || fail 'the release must keep public/.htaccess, not the controller fallback'
[[ "$(ls -A "$root/releases/$id")" == public ]] || fail 'a static release must hold only public/'

token=check-http01
mkdir -p "$public/.well-known/acme-challenge"
printf 'http01-verification\n' > "$public/.well-known/acme-challenge/$token"
chmod -R a+rX "$public/.well-known"

cat > "$work/httpd.conf" <<'CONF'
ServerRoot /usr/local/apache2
ServerName localhost
Listen 80
LoadModule mpm_event_module modules/mod_mpm_event.so
LoadModule unixd_module modules/mod_unixd.so
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule dir_module modules/mod_dir.so
LoadModule mime_module modules/mod_mime.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule headers_module modules/mod_headers.so
User www-data
Group www-data
TypesConfig conf/mime.types
ErrorLog /proc/self/fd/2
DocumentRoot /site
<Directory /site>
  AllowOverride All
  Require all granted
</Directory>
CONF
docker network create "$network" >/dev/null
docker run -d --name "$site" --network "$network" -p "127.0.0.1:$port:80" \
  -v "$public:/site:ro" -v "$work/httpd.conf:/usr/local/apache2/conf/httpd.conf:ro" httpd:2.4 >/dev/null
for _ in {1..30}; do
  curl --silent --output /dev/null "$base/" && break
  sleep 1
done

status() { curl --silent --output /dev/null --write-out '%{http_code}' "$base$1"; }
header() { curl --silent --head "$base$1" | tr -d '\r' | sed -n "s/^$2: //Ip"; }
expect_status() { [[ "$(status "$2")" == "$1" ]] || fail "$2 should answer $1, got $(status "$2")"; }

bundle=$(basename "$(ls "$public"/assets/index-*.js)")
expect_status 200 /
expect_status 200 "/assets/$bundle"
[[ "$(header / Cache-Control)" == no-cache ]] || fail 'the page must be rechecked on every visit'
[[ "$(header "/assets/$bundle" Cache-Control)" == *immutable* ]] || fail 'hashed bundles must be cached for good'
[[ "$(header "/assets/$bundle" Content-Type)" == *javascript* ]] || fail 'the bundle must be served as JavaScript'
for asset in "$public"/assets/*; do
  [[ "$(header "/assets/$(basename "$asset")" Cache-Control)" == *immutable* ]] || fail "$(basename "$asset") must be cached for good"
done

# A removed bundle must fail as a 404, without a long cache life and without HTML.
expect_status 404 /assets/index-AAAAAAAA.js
[[ -z "$(header /assets/index-AAAAAAAA.js Cache-Control)" ]] || fail 'a 404 must not carry a cache lifetime'
for path in /level/3 /package.json /src/main.ts /node_modules/; do expect_status 404 "$path"; done

[[ "$(curl --silent "$base/.well-known/acme-challenge/$token")" == http01-verification ]] || fail 'HTTP-01 token must be served'
expect_status 404 /.well-known/acme-challenge/missing-token
for path in /.htaccess /.env /.git/config /.well-known/private /.well-known/acme-challenge/ /.well-known/acme-challenge/.env; do
  expect_status 403 "$path"
done

live_host='Host: tumbleworks.starbugstone.com'
redirect() { curl --silent --output /dev/null --write-out '%{http_code} %{redirect_url}' --header "$live_host" "$@"; }
[[ "$(redirect "$base/level?x=1%20y")" == '301 https://tumbleworks.starbugstone.com/level?x=1%20y' ]] || fail 'HTTP must redirect to HTTPS, keeping the path and query'
[[ "$(redirect --header 'X-Forwarded-Proto: https' "$base/")" == '200 ' ]] || fail 'a request already on HTTPS must not redirect, or the site loops'
[[ "$(redirect "$base/.well-known/acme-challenge/$token")" == '200 ' ]] || fail 'HTTP-01 tokens must be served without a redirect'

php tests/o2switch/site-build.php ready "$source_dir" "$root" "$id" "$base" || { tail -n 10 "$root/logs/control.log"; exit 1; }
tail -n 1 "$root/logs/control.log" | grep -q '"result":"ready"' || fail 'static readiness did not report ready'
echo 'Hosting build and Apache checks passed.'

# Dependencies install inside the disposable source, so this also runs where node_modules is a Docker volume.
docker run --rm --network "$network" --user "$(id -u):$(id -g)" -e HOME=/tmp -e "TUMBLEWORKS_URL=http://$site" \
  -v "$source_dir:/app" -w /app mcr.microsoft.com/playwright:v1.64.1-noble \
  sh -c 'npm ci --no-audit --no-fund && npx playwright test tests/e2e/smoke.spec.ts'
