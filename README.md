# Tumbleworks

A browser marble-sorting game. Tap a packet, watch the marbles ride the belt, and fill the boxes in order without jamming the machine.

This is a proof of concept. The plan and the reasoning behind it are in [docs/poc-plan.md](docs/poc-plan.md).

## Run it

You need Docker.

```sh
docker compose up --build
```

Open <http://localhost:5180>. To play on a phone, connect it to the same Wi-Fi and open `http://<your-computer's-LAN-address>:5180`.

The server is reachable by anyone on your network, so only run it on a network you trust.

## Tests

```sh
docker compose exec dev npm test                       # rules and simulation
docker compose exec dev npm run typecheck
docker compose run --rm e2e npx playwright test        # browser journey
```

To use a different port, set `TUMBLEWORKS_PORT` before starting.
