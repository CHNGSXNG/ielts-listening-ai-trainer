# IELTS Listening AI Trainer

A local-first IELTS listening practice application with an English or Simplified Chinese interface, real audio transcription, word-aligned sentence playback, Shadowing, inline Cloze, sentence-scoped Word Bank exercises, saved attempts, learning analysis, and local backup.

No paid API is required. Dependencies and Whisper models are not committed to this repository; the setup commands install them on the user's computer after explicit confirmation.

## macOS Quick Start

For a new installation, double-click:

```text
setup.command
```

This checks Python and Node.js, installs the frontend and backend dependencies, asks before downloading the configured Whisper model, and starts the application.

For later offline starts, double-click:

```text
start.command
```

To stop only this project's local processes or inspect the installation:

```text
stop.command
doctor.command
```

Start-only mode never downloads or installs anything. It reports missing or incomplete dependencies and models instead.

To install or repair only the local transcription model, double-click:

```text
scripts/download-models.command
```

The full maintenance menu is available through `Mac/Mac.command`:

1. Setup or repair missing items, then start
2. Start only, without downloads
3. Download and verify the Whisper model
4. Show installation status
5. Remove generated dependencies and model cache

If macOS removes executable permissions after archive extraction, run:

```bash
chmod +x setup.command start.command scripts/download-models.command Mac/Mac.command
```

## Windows Quick Start

Double-click:

```text
Windows/Windows.bat
```

The Windows menu provides the same setup, start-only, model download, status, and uninstall operations. Missing Node.js and Python can be installed inside the project runtime without replacing system-wide installations. Model files are checksum-verified before startup.

## Local URLs

- Frontend: http://127.0.0.1:3001
- Backend health: http://127.0.0.1:8000/health
- Backend API documentation: http://127.0.0.1:8000/docs

Keep the command window open while using the app. Closing it stops the local frontend and backend.

## Interface Language

Open `Settings > Appearance > Interface Language` and choose `English` or `简体中文`. The change applies immediately, survives browser restarts, and is included in local backups. Existing installations default safely to English until the user changes the preference.

For iPhone Safari on the same trusted Wi-Fi network:

```bash
LAN_ACCESS=1 ./start.command
```

The command prints the iPhone URL. Default startup remains local-only.

## Local Model

The default model is `base`. It offers better transcription quality than `tiny`, while remaining practical for local use.

Set `WHISPER_MODEL` before setup to choose another supported model:

```bash
WHISPER_MODEL=tiny ./scripts/download-models.command
WHISPER_MODEL=tiny ./start.command
```

Useful values are `tiny`, `base`, and `small`. A missing or incomplete model produces a visible error; the backend never silently downloads a model and never substitutes a demo transcript.

Models are stored outside the Git repository under the user's Whisper cache. Uploaded and URL-imported audio is cached locally and is excluded from backups and release archives.

## Core Behavior

- Real local file upload and safe public audio URL import
- Local Whisper transcription with word timestamps
- Non-overlapping sentence boundaries built from aligned words
- One real audio element for progress, seeking, playback rate, full playback, and sentence loops
- Shadowing answers, scores, retries, and attempt history stored by sentence
- Correct answers hidden until submission or explicit reveal
- Inline Cloze and a sentence-scoped Word Bank with stable Fisher-Yates shuffling and consume-and-restore behavior
- Unified Shadowing lyrics viewport with independent audio, viewed-sentence, and practice-sentence state
- One intentional Practice workspace scroll area
- One functional status-light component driven by real application state
- IndexedDB session persistence with a localStorage recovery mirror
- Versioned JSON backup/import; audio blobs are excluded
- Analysis derived from stored attempts rather than sample metrics

## Repository Layout

```text
AppFiles/
  frontend/                 Next.js application
  backend/                  FastAPI and local transcription services
Mac/Mac.command             macOS setup and maintenance menu
Windows/Windows.bat         Windows setup and maintenance menu
scripts/download-models.command
scripts/build-release.command  create a lightweight source archive
setup.command               first-time macOS setup
start.command               offline macOS start
stop.command                safely stop only project processes
doctor.command              installation and runtime diagnostics
docs/                       installation, architecture, privacy, troubleshooting, and regression guides
.github/workflows/ci.yml    frontend and backend verification
.github/workflows/release.yml  tag-based GitHub Release publishing
CONTRIBUTING.md             contributor setup and quality checks
SECURITY.md                 responsible vulnerability reporting
LICENSE                     MIT open-source license
```

Generated dependencies, build output, models, uploads, audio caches, backups, and runtime session data are excluded by `.gitignore`.

## Development And Verification

Backend:

```bash
cd AppFiles/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m unittest discover -s tests -v
python -m compileall -q app tests
```

Frontend:

```bash
cd AppFiles/frontend
npm ci
npm run test:core
npm run build
```

The complete manual and automated release procedure is in [docs/REGRESSION.md](docs/REGRESSION.md).

Create the same lightweight source archive used for GitHub releases with:

```bash
./scripts/build-release.command
```

The archive is written to `release/` and excludes dependencies, models, caches, uploaded audio, runtime state, build output, and previous archives.

After pushing the repository, publish a verified GitHub Release by tagging the same version as `AppFiles/frontend/package.json`:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The Release workflow reruns frontend and backend checks before attaching the lightweight source archive.

---

## 中文说明

IELTS Listening AI Trainer 是一个本地优先的雅思听力训练应用。界面可在设置中即时切换英语和简体中文。它支持真实音频上传和公开 URL 导入、本地 Whisper 转写、逐词时间对齐、精准按句播放、精听、原文内嵌填空、句子级选词填空、作答记录、学习分析和本地备份。

项目不需要付费 API。GitHub 仓库不包含依赖目录和 Whisper 模型；首次运行 `setup.command` 时会在明确提示后由用户电脑自行下载。以后使用 `start.command` 可在不下载、不安装任何内容的情况下启动。

若模型缺失或损坏，应用会明确报错，不会静默下载，也不会用试音或示例文字冒充真实转写。完整验收步骤见 `docs/REGRESSION.md`。
