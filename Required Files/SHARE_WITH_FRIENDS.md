# Share This App With Friends

This package is organized into three folders:

- `Mac`: macOS launcher
- `Windows`: Windows launcher
- `Required Files`: app code, dependencies, and support files

## What your friend needs first

They need these installed:

- Python 3.10 or newer: https://www.python.org/downloads/

Node.js is downloaded automatically into `Required Files/.runtime` if it is not already installed.

On Windows, while installing Python, enable **Add python.exe to PATH**.

## macOS

1. Unzip the project folder.
2. Open the `Mac` folder.
3. Double-click `IELTS Listening AI Trainer.app`.
4. If macOS blocks it, right-click the file, choose **Open**, then confirm.
5. The app opens at `http://localhost:3000`.

If the app launcher does not open, double-click `start-mac.command` in the same `Mac` folder.

If double-clicking the script does nothing, open Terminal in the `Mac` folder and run:

```bash
chmod +x start-mac.command
./start-mac.command
```

## Windows

1. Unzip the project folder.
2. Open the `Windows` folder.
3. Double-click `IELTS Listening AI Trainer.bat`.
4. Keep the two command windows open while using the app.
5. The app opens at `http://localhost:3000`.

If the app launcher does not open, double-click `start-windows.bat` in the same `Windows` folder.

## First Run

The first run can take several minutes because it may download a private Node.js runtime, install dependencies, and download the Whisper model. Later runs are faster.

The start scripts try the official package sources first. If that fails, they automatically retry with common China-friendly mirrors:

- npm: `https://registry.npmmirror.com`
- Python packages: `https://pypi.tuna.tsinghua.edu.cn/simple`
- Whisper model: official Hugging Face first, then `https://hf-mirror.com`

## Stop The App

- macOS: close the Terminal window running the app.
- Windows: close the backend and frontend command windows.

## Uninstall

To remove the whole package and downloaded app files:

- macOS: run `Mac/uninstall-delete-everything.command`
- Windows: run `Windows/uninstall-delete-everything.bat`

The uninstaller asks the user to type `DELETE` before removing anything.

## Privacy

Audio transcription runs locally on the user's computer. The first Whisper model download uses the internet, but the app itself does not use a paid OpenAI API.

For a detailed safety explanation, read `SECURITY_AND_PRIVACY.md`.
