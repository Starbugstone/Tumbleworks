<?php
/**
 * Runs the real controller's build and readiness steps with the settings docs/deployment.md
 * gives the host. Run: php site-build.php build|ready SOURCE ROOT RELEASE_ID [URL]
 */
declare(strict_types=1);
require __DIR__.'/../../scripts/o2switch/deploy.php';

class SiteDeployer extends HostingDeployer
{
    public function buildRelease(string $sha, string $id): void
    {
        $this->build($sha, $id);
    }

    public function ready(string $id, string $url): bool
    {
        $this->config['url'] = $url; // The test Apache has no certificate; config validation requires https.
        return $this->healthy($id);
    }
}

umask(0027); // deploy.php's own entry point sets this.
[, $command, $source, $root, $id] = $argv;
$deployer = new SiteDeployer([
    'root' => $root, 'repository_path' => $source, 'github_repository' => 'Starbugstone/Tumbleworks',
    'branch' => 'main', 'workflow' => 'ci.yml', 'token_file' => "$root/shared/github-token",
    // The host's path, never run for a static build. The controller puts its directory first on
    // PATH, and PHP_BINARY's /usr/bin would let a system Node shadow node_bin_dir here.
    'php_bin' => '/opt/alt/php83/usr/bin/php', 'composer_bin' => '/usr/local/bin/composer',
    'node_bin_dir' => dirname(realpath(trim((string) shell_exec('command -v node')))),
    'url' => 'https://tumbleworks.starbugstone.com', 'keep_releases' => 3,
    'profile' => 'vite-static', 'frontend_dir' => '.', 'frontend_output' => 'dist', 'health_mode' => 'static',
]);
if ($command === 'build') {
    $deployer->buildRelease(substr($id, 0, 40), $id);
} elseif (!$deployer->ready($id, $argv[5])) {
    throw new RuntimeException('Static readiness check failed; see logs/control.log.');
}
