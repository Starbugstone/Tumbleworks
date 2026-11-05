# Deployment

A push to `main` goes live on <https://tumbleworks.starbugstone.com> by itself, once CI has passed on that commit. The first half of this page explains how; the [first-time setup](#first-time-setup) and [maintenance](#maintenance) sections are the commands to run on the host.

`main` is the only target: there is no preprod, so anything pushed to `main` reaches players after CI.

## How a release goes live

1. GitHub Actions runs `.github/workflows/ci.yml` on the push. It uploads nothing and holds no hosting credentials.
2. On o2switch, a cPanel cron job runs the controller every minute. The controller fetches `main` and asks GitHub whether the push run for that exact commit succeeded. A failed run blocks that commit, and each failed commit is attempted only once.
3. The controller builds the commit in a private directory with `npm ci` and `npm run build`, then copies `dist/` into a new release directory.
4. It switches the `current` symlink to the new release, then checks that `/release.txt` names that release and that `/` returns HTML. If either check fails, it switches back to the previous release.
5. It keeps the three most recent releases for rollback.

The host starts every connection, so GitHub needs no secret and no access to the host.

## What CI checks

Every job in `ci.yml` gates deployment.

| Job | Checks |
| --- | --- |
| `game` | `npm ci`, typecheck, lint, unit tests including the physics and scripted witnesses, build with its first-download budget |
| `browser` | Fourteen real-touch and rendering checks, using the Compose game server and pinned Playwright image with two workers |
| `hosting` | The controller's own tests, then `tests/o2switch/site-test.sh` |

`site-test.sh` builds the commit with the real controller and the settings below, and serves the release with Apache. It checks the cache headers, the 404 and 403 rules, the HTTPS redirect and certificate renewal, then runs `tests/e2e/smoke.spec.ts` in Chromium: the page boots, the board draws, a real tap reaches the game and all registered campaign levels are listed (currently 120), derived from `CAMPAIGN` rather than an old fixed count.

The full Playwright suite and standalone performance test are not currently in the gate. The earlier 21-minute run and loaded instruction-toast failure are historical ninety-level observations, not the duration or result of the 120-level release. Run the full suite on the reviewed release revision, then run performance alone with `--no-deps`, and record actual results in [verification.md](verification.md). Browser measurements do not establish physical-phone performance.

The browser job runs [input-regressions.spec.ts](../tests/e2e/input-regressions.spec.ts)
(picker swipes, slide taps, independent fast-forward holds, wait hints and Restart) and
[render-hygiene.spec.ts](../tests/e2e/render-hygiene.spec.ts). These fourteen tests passed
three consecutive local repetitions with two workers: 42/42 in 5.0 minutes. The
first hosted run is still pending during this review. Rule-variant specs such as
[loop-features.spec.ts](../tests/e2e/loop-features.spec.ts) remain part of the full
local release verification.

## Settings on the host

| Setting | Value |
| --- | --- |
| Site | `https://tumbleworks.starbugstone.com` |
| Deployment root | `$HOME/apps/tumbleworks` |
| Document root | `$HOME/apps/tumbleworks/current/public` |
| Git checkout | `$HOME/repositories/tumbleworks`, cloned over HTTPS because the repository is public |
| Branch, workflow | `main`, `ci.yml` |
| Build profile | `vite-static`, frontend directory `.`, output `dist`, static health check |
| PHP (runs the controller) | `/opt/alt/php83/usr/bin/php` |
| Node (builds the site) | `/opt/alt/alt-nodejs24/root/usr/bin` |
| Secret | `shared/github-token`, read-only access to this repository's Actions runs |

## First-time setup

Run the terminal commands in cPanel's Terminal or over SSH, as your cPanel user.

**Before you start:** CI must have passed on `main` with these files in it.

### 1. Create the GitHub token

In GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Select **Only select repositories** and choose `Starbugstone/Tumbleworks`. Under repository permissions, set **Actions** to **Read-only**. Pick an expiry date and note it, because deployments stop when the token expires.

Keep the token ready for step 3, and don't paste it anywhere else.

### 2. Clone and install

```bash
project_php=/opt/alt/php83/usr/bin/php
project_root="$HOME/apps/tumbleworks"
project_checkout="$HOME/repositories/tumbleworks"
mkdir -p "$HOME/repositories"
git clone https://github.com/Starbugstone/Tumbleworks.git "$project_checkout"
bash "$project_checkout/scripts/o2switch/install.sh" "$project_root"
```

Expected: `Installed in …/control` and `Fresh installations have automatic deployment disabled`.

Run this step before creating the subdomain. `current` must be a symlink, and cPanel creates a real directory when the document root doesn't exist yet.

### 3. Configure

```bash
"$project_php" "$project_root/control/configure.php" "$project_root"
```

Answer the prompts as follows. "Enter" means accept the default in brackets.

| Prompt | Answer |
| --- | --- |
| GitHub repository | `Starbugstone/Tumbleworks` |
| Existing Git checkout | Enter |
| Site URL | `https://tumbleworks.starbugstone.com` |
| Git access | `public-https` |
| Deployment branch | Enter (`main`) |
| CI workflow filename | Enter (`ci.yml`) |
| Build profile | `vite-static` |
| Frontend directory | `.` (a single dot) |
| Build output | Enter (`dist`) |
| Node/npm binary directory | Enter |
| GitHub Actions read token | Paste the token. Nothing appears as you paste. |

Expected: `Saved private configuration`, then the document root and the cron command. Polling stays off.

An invalid answer stops the tool before it saves anything, so you can run it again. A valid but wrong answer is saved, and the tool then refuses to run a second time: correct that value in `control/config.json` instead.

### 4. Create the subdomain and certificate

In cPanel's **Domains** tool, create `tumbleworks.starbugstone.com` with the document root `apps/tumbleworks/current/public`. Turn off the option that shares the document root with the main domain. Opening the site over HTTP should show **Awaiting first deployment**.

In **Let's Encrypt SSL**, issue a certificate for this subdomain only, with **http-01** validation. Expected: `curl --fail https://tumbleworks.starbugstone.com/` prints the placeholder page. Skip cPanel's **Force HTTPS Redirect**: `public/.htaccess` redirects HTTP to HTTPS from the first deployment on.

A 403 usually means `~/apps` can't be traversed. Check with `ls -ld ~/apps`, and if needed run `chmod o+x ~/apps`, without recursion.

### 5. Deploy once by hand

```bash
"$project_php" "$project_root/control/deploy.php" "$project_root/control/config.json" check
bash "$project_root/control/run.sh" "$project_php" deploy
"$project_php" "$project_root/control/deploy.php" "$project_root/control/config.json" status
```

Expected from `check`: `Git access works. CI for <sha>: passed`. The `deploy` command can stay quiet for a few minutes, because it writes to the log. `status` should then show `"status": "success"` and a `current` release starting with that commit.

If the deploy fails, `tail -n 60 "$project_root/logs/cron.log"` and the newest file in `$project_root/logs/` say why. The placeholder page stays up. After fixing the cause, repeat with `retry` in place of `deploy`.

Then open the site and tap a crate. Check that the release marker matches `status`, and that hidden files are blocked:

```bash
curl -s https://tumbleworks.starbugstone.com/release.txt
curl -s -o /dev/null -w '%{http_code}\n' https://tumbleworks.starbugstone.com/.htaccess   # expect 403
```

### 6. Turn on automation

```bash
"$project_php" "$project_root/control/deploy.php" "$project_root/control/config.json" enable
printf '/bin/bash %s/control/run.sh %s poll\n' "$project_root" "$project_php"
```

Paste the printed line into cPanel → **Cron Jobs**, as one new job with all five schedule fields set to `*`. The saved command must show full paths, not `$project_root`.

### 7. Prove it end to end

Watch the log, then push a small change to `main`:

```bash
tail -n 0 -F "$project_root/logs/cron.log"
```

Expected: `Deployed <release id>` once CI has passed and the build has finished, and `/release.txt` shows the new release. Press Ctrl+C to stop watching. That only stops `tail`, not the deployment.

## Maintenance

Set the variables from step 2 again in each new terminal session.

| Task | Command or action |
| --- | --- |
| See what is live | `curl -s https://tumbleworks.starbugstone.com/release.txt` (starts with the commit SHA) |
| See deployer state | `"$project_php" "$project_root/control/deploy.php" "$project_root/control/config.json" status` |
| Pause deployments | Same command, ending in `disable` |
| Resume deployments | Same command, ending in `enable` |
| Rebuild a commit that failed | `bash "$project_root/control/run.sh" "$project_php" retry` |
| Roll back | `bash "$project_root/control/run.sh" "$project_php" rollback FULL_RELEASE_ID`, with an ID from `status`. Rollback turns polling off, so run `enable` when you are ready. |
| Renew the token | Create a replacement with the same permission, then follow [the token procedure](https://github.com/Starbugstone/test-auto-deploy/blob/main/docs/o2switch-setup.md#4-configure-the-private-files) with `$project_root/shared/github-token` as the destination. Run `check` before revoking the old token. |

A push that changes nothing visible usually means one of these: `enabled` is false in `status`, CI failed on that commit, or that commit was already attempted and failed. `state.attempt.status` and `logs/cron.log` tell them apart. Repeated `Waiting for successful push CI` lines are normal while CI is running. Never delete a lock file.

### Updating the controller

Deployments don't replace the files in `control/`. To install a new version, pause polling and wait for `Automatic polling disabled`, then:

```bash
git -C "$project_checkout" pull --ff-only origin main
bash "$project_checkout/scripts/o2switch/install.sh" "$project_root"
"$project_php" "$project_root/control/deploy.php" "$project_root/control/config.json" check
```

Then enable polling again. The installer keeps the configuration, the token and the release history.

## Where the files come from

These are unchanged copies from [`Starbugstone/test-auto-deploy`](https://github.com/Starbugstone/test-auto-deploy) at commit `9e94f20`, the same controller Prospect Hollow runs. Fix problems there first, then copy them here:

- `scripts/o2switch/`
- `tests/o2switch/` `deploy-test.php`, `health-test.php`, `setup-test.php`, `install-test.sh`, `setup-terminal-test.py`

The template's [setup guide](https://github.com/Starbugstone/test-auto-deploy/blob/main/docs/o2switch-setup.md) covers the controller in more depth, including troubleshooting.

These files are specific to Tumbleworks:

- `.github/workflows/ci.yml`
- `public/.htaccess`, which Vite copies into each release so the controller keeps it. It rechecks the page on every visit and caches hashed bundles for good, so phones pick up a release straight away. It redirects HTTP to HTTPS on the real host only, so the local test Apache stays on HTTP. It has no fallback to `index.html`, because a removed bundle answered with HTML would leave a black page. Keep its certificate-renewal rule.
- `tests/o2switch/site-build.php`, `tests/o2switch/site-test.sh`, `tests/e2e/smoke.spec.ts`

The template repository is private, so its links need your GitHub login.
