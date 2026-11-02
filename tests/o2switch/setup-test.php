<?php
declare(strict_types=1);
require __DIR__.'/../../scripts/o2switch/configure.php';

class SetupFixture extends HostingSetup
{
    public array $answers = [];
    protected function ask(string $label, string $default = '', bool $secret = false): string
    {
        return $this->answers[$label] ?? $default;
    }
}
function checkSetup(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
$parent = str_starts_with(getenv('HOME') ?: '', '/home/') ? getenv('HOME') : '/home';
$base = $parent.'/hosting-setup-test-'.bin2hex(random_bytes(6));
mkdir($base, 0700);
$oldUmask = umask(0077);
try {
    $newFixture = function (string $name, string $profile = 'symfony-vite') use ($base): array {
        $root = "$base/$name";
        mkdir($root, 0700);
        foreach (['control', 'shared', 'state', 'logs', 'builds', 'releases', 'repo', 'bin'] as $directory) mkdir("$root/$directory", 0700);
        copy(__DIR__.'/../../scripts/o2switch/config.example.json', "$root/control/config.json");
        copy(__DIR__.'/../../scripts/o2switch/app.env.example', "$root/shared/.env.local");
        foreach (['node', 'npm'] as $binary) { file_put_contents("$root/bin/$binary", "#!/bin/sh\nexit 0\n"); chmod("$root/bin/$binary", 0700); }
        $setup = new SetupFixture($root);
        $setup->answers = [
            'GitHub repository (OWNER/REPOSITORY)' => 'example/project',
            'Existing Git checkout' => "$root/repo",
            'Site URL (https://domain, no trailing slash)' => 'https://demo.example.com',
            'Git access: public-https or private-ssh' => 'public-https',
            'Build profile: symfony-vite or vite-static' => $profile,
            'Node/npm binary directory' => "$root/bin",
            'Full database name (including cPanel prefix)' => 'account_test-db',
            'Full database user (may differ from database name)' => 'account_testuser',
            'Database password (hidden)' => 'dummy-only:pa%ss$word!()/@',
            'GitHub Actions read token (hidden; required for both repository types)' => 'dummy_token_for_test_only',
        ];
        return [$setup, $root];
    };
    [$setup, $root] = $newFixture('public');
    ob_start(); $setup->run(); $output = ob_get_clean();
    $config = HostingDeployer::readJson("$root/control/config.json");
    $env = file_get_contents("$root/shared/.env.local");
    checkSetup($config['ssh_key'] === '' && $config['php_bin'] === PHP_BINARY, 'Public HTTPS must not require an SSH key; record actual PHP binary');
    checkSetup(str_contains($env, 'account_testuser:'.rawurlencode('dummy-only:pa%ss$word!()/@').'@localhost:3306/account_test-db?'), 'Encode special characters and retain distinct database/user names');
    checkSetup((bool)preg_match('/APP_SECRET=[a-f0-9]{64}\n/', $env), 'Generate application secret');
    checkSetup(!str_contains($output, 'dummy') && !str_contains(file_get_contents("$root/control/config.json"), 'dummy'), 'No secrets in output/config JSON');
    foreach (['control/config.json', 'shared/.env.local', 'shared/github-token'] as $file) checkSetup((fileperms("$root/$file") & 0777) === 0600, 'Private file permissions');
    checkSetup(!file_exists("$root/state/enabled"), 'Setup must leave deployment disabled');
    $before = $env;
    try { $setup->run(); throw new LogicException('Expected reconfiguration refusal'); } catch (RuntimeException $e) {
        checkSetup(str_contains($e->getMessage(), 'Already configured'), 'Reject repeat setup');
    }
    checkSetup(file_get_contents("$root/shared/.env.local") === $before, 'Never regenerate existing application secret');

    [$setup, $root] = $newFixture('private', 'vite-static');
    $setup->answers['Git access: public-https or private-ssh'] = 'private-ssh';
    $setup->answers['Private SSH key path'] = "$root/private-key";
    file_put_contents("$root/private-key", 'dummy-key');
    $originalEnv = file_get_contents("$root/shared/.env.local");
    $setup->run();
    $config = HostingDeployer::readJson("$root/control/config.json");
    checkSetup($config['health_mode'] === 'static' && $config['ssh_key'] === "$root/private-key", 'Private/static configuration');
    checkSetup(file_get_contents("$root/shared/.env.local") === $originalEnv, 'Static setup skips database credentials');

    [$setup, $root] = $newFixture('preserve');
    file_put_contents("$root/shared/.env.local", "APP_SECRET=existing-test-secret\n");
    file_put_contents("$root/shared/github-token", 'existing_test_token');
    $setup->run();
    checkSetup(file_get_contents("$root/shared/github-token") === 'existing_test_token' && file_get_contents("$root/shared/.env.local") === "APP_SECRET=existing-test-secret\n", 'Preserve existing secrets during first-time setup');

    [$setup, $root] = $newFixture('invalid');
    $setup->answers['GitHub Actions read token (hidden; required for both repository types)'] = '';
    $configBefore = file_get_contents("$root/control/config.json");
    $envBefore = file_get_contents("$root/shared/.env.local");
    try { $setup->run(); throw new LogicException('Expected invalid-token refusal'); } catch (RuntimeException) {}
    checkSetup(file_get_contents("$root/control/config.json") === $configBefore && file_get_contents("$root/shared/.env.local") === $envBefore, 'Validate all inputs before saving');
    $lock = fopen("$root/deploy.lock", 'c'); flock($lock, LOCK_EX);
    try { $setup->run(); throw new LogicException('Expected lock refusal'); } catch (RuntimeException $e) { checkSetup(str_contains($e->getMessage(), 'running'), 'Setup respects deployment lock'); }
    flock($lock, LOCK_UN); fclose($lock);
    unlink("$root/shared/.env.local"); symlink("$root/control/config.json", "$root/shared/.env.local");
    try { $setup->run(); throw new LogicException('Expected symlink refusal'); } catch (RuntimeException $e) { checkSetup(str_contains($e->getMessage(), 'symlink'), 'Setup rejects secret symlinks'); }
    echo "Setup tests passed: public/private, Symfony/static, encoded credentials, no secret output, private permissions, preserved configuration, validation and locks.\n";
} finally {
    HostingDeployer::removeTree($base);
    umask($oldUmask);
}
