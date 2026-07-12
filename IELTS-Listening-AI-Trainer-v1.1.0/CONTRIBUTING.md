# Contributing

## Local setup

Run `setup.command` on macOS or `Windows/Windows.bat` on Windows. Models, dependencies, caches, and test audio must remain outside Git.

## Required checks

```bash
cd AppFiles/frontend
npm ci
npm run lint
npm run test:core
npm run build

cd ../backend
python -m unittest discover -s tests -v
python -m compileall -q app tests
```

Keep audio timing, scoring, persistence, and practice-state changes covered by focused tests. Preserve English and Simplified Chinese labels for new user-facing controls.

Before opening a pull request, run `doctor.command` and confirm no model, audio, cache, `.env`, dependency, or runtime file is staged.
