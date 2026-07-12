# Troubleshooting

Run `doctor.command` first. It checks Python, Node.js, dependencies, ports, the model, alignment, storage permissions, backend health, and audio decoding.

## Backend unavailable

Keep the `start.command` window open. If port 8000 is occupied by another app, close that app or start with another `BACKEND_PORT`.

## Model missing or invalid

Run `scripts/download-models.command`, choose a supported model, and wait for verification to finish. Models are stored outside the repository.

## Audio cannot be decoded

Run `setup.command` to repair backend dependencies. Confirm the file is a supported, non-empty audio file.

## URL import fails

Use a direct public HTTP or HTTPS audio URL. Private-network addresses, `file://` URLs, oversized downloads, redirect loops, and non-audio responses are rejected.

## Uploaded audio disappears after browser cleanup

Re-upload the source. Learning records are separate from audio cache and remain available unless local learning data was also cleared.

## Frontend dependencies fail to install

Check the network connection and rerun `setup.command`; `npm ci` resumes from the package cache where possible.

## Stale local processes

Run `stop.command`. It verifies process ownership and does not terminate unrelated Python or Node processes.
