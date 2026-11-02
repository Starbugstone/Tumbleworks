#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
fixture=$(mktemp -d "$HOME/launchpad-install-test-XXXXXX")
root="$fixture/new/apps/project"
trap 'rm -rf "$fixture"' EXIT
bash scripts/o2switch/install.sh "$root"
[[ -L "$root/current" && ! -e "$root/state/enabled" ]]
[[ -x "$root/control/configure.php" && -f "$root/control/app.env.example" ]]
python3 - "$fixture" "$root" <<'PY'
import pathlib, sys
fixture, root = map(pathlib.Path, sys.argv[1:])
assert fixture.stat().st_mode & 0o777 == 0o700, 'Do not relax existing ancestor permissions'
for parent in [fixture/'new', fixture/'new/apps']:
    mode = parent.stat().st_mode & 0o777
    assert mode & 0o011 == 0o011, 'Web server must traverse newly created ancestors'
    assert mode & 0o066 == 0, 'Ancestor traversal must not grant directory listing or writes'
for private in ['control', 'shared', 'state', 'logs', 'builds']:
    assert (root/private).stat().st_mode & 0o077 == 0, 'Deployment internals must remain private'
public = root/'current/public'
assert public.stat().st_mode & 0o005 == 0o005
assert (public/'index.html').stat().st_mode & 0o004, 'Bootstrap page must be readable by web server'
assert (root/'shared/.env.local').stat().st_mode & 0o077 == 0
PY
python3 - "$root" "$PWD" "$(command -v php)" <<'PY'
import json, pathlib, sys
root, repo, php = sys.argv[1:]
p = pathlib.Path(root) / 'control/config.json'
v = json.loads(p.read_text())
v.update(root=root, repository_path=repo, token_file=root+'/shared/github-token', php_bin=php)
p.write_text(json.dumps(v))
PY
php "$root/control/deploy.php" "$root/control/config.json" enable
chmod 750 "$fixture/new/apps"
bash scripts/o2switch/install.sh "$root"
[[ "$(stat -c %a "$fixture/new/apps")" == 750 ]]
[[ -e "$root/state/enabled" ]]
bash "$root/control/run.sh" "$(command -v php)" status
python3 - "$root" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
assert json.loads((root/'control/config.json').read_text())['root'] == str(root)
assert json.loads((root/'logs/cron.log').read_text())['enabled'] is True
assert (root/'control/config.json').stat().st_mode & 0o777 == 0o600
PY
php "$root/control/deploy.php" "$root/control/config.json" disable
[[ ! -e "$root/state/enabled" ]]
echo 'Installer/wrapper tests passed: parent traversal, preserved ancestor permissions, private config, bootstrap, disabled default, preserved state, command arguments.'
