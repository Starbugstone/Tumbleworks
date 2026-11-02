"""Exercise actual hidden Bash input with a disposable value and a pseudo-terminal."""
import hashlib
import os
from pathlib import Path
import pty
import select
import subprocess
import termios
import time

root = Path(__file__).resolve().parents[2]
php = r'''
require 'scripts/o2switch/configure.php';
class TerminalSetup extends HostingSetup {
    public function prompt(): string { return $this->ask('Hidden test', '', true); }
}
echo hash('sha256', (new TerminalSetup('/unused'))->prompt()), PHP_EOL;
'''
master, slave = pty.openpty()
# Even a shell exporting xtrace must not make the hidden reader print the value.
environment = dict(os.environ, SHELLOPTS='xtrace')
process = subprocess.Popen(['php', '-r', php], cwd=root, stdin=slave, stdout=slave, stderr=slave, env=environment)
transcript = b''
secret = b'disposable-terminal-test:%$!()/@'
try:
    deadline = time.monotonic() + 10
    sent = False
    while time.monotonic() < deadline:
        if select.select([master], [], [], 0.05)[0]:
            transcript += os.read(master, 8192)
        # Wait for Bash to disable echo, not merely for PHP to print its prompt.
        if not sent and b'Hidden test:' in transcript and not termios.tcgetattr(slave)[3] & termios.ECHO:
            os.write(master, secret + b'\n')
            sent = True
        if process.poll() is not None:
            while select.select([master], [], [], 0)[0]:
                transcript += os.read(master, 8192)
            break
    assert process.poll() == 0, 'Hidden prompt did not complete'
    assert secret not in transcript, 'Hidden input was echoed'
    assert hashlib.sha256(secret).hexdigest().encode() in transcript, 'Special characters changed during input'
    assert termios.tcgetattr(slave)[3] & termios.ECHO, 'Terminal echo was not restored'
    print('Hidden terminal input passed: no echo, unchanged special characters, restored terminal.')
finally:
    if process.poll() is None:
        process.kill()
    process.wait()
    os.close(master)
    os.close(slave)
