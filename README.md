# IELTS Listening AI Trainer

## English

IELTS Listening AI Trainer is a local-first listening practice app. It supports audio upload, local Whisper transcription, sentence-based listening practice, cloze practice, scoring, and analysis.

The repository is intentionally small. It does not include dependency folders or Whisper model files. Those files are downloaded on the user's own computer by the command files.

### Folder Layout

```text
Mac/         one macOS command file
Windows/     one Windows command file
AppFiles/    required app source files
```

### macOS

Double-click:

```text
Mac/Mac.command
```

Menu options:

- install dependencies, download model, and start
- start only
- download/refresh Whisper model only
- uninstall generated files and model cache

### Windows

Double-click:

```text
Windows/Windows.bat
```

It shows the same menu as the macOS command.

### Ports

- Frontend: http://127.0.0.1:3001
- Backend API: http://127.0.0.1:8000

### Model

Default model is `base`, which gives a better first-run transcription experience than `tiny`.

To use another model, set `WHISPER_MODEL` before running the command file.

You can still use a lighter or larger model by setting `WHISPER_MODEL`.

Useful values:

```text
tiny
base
small
```

No paid APIs are required.

---

## 中文

IELTS Listening AI Trainer 是一个本地优先的雅思听力训练应用。它支持上传音频、本地 Whisper 转写、按句精听、填空练习、自动评分和学习分析。

这个仓库会尽量保持很小。仓库内不包含依赖文件夹，也不包含 Whisper 模型文件。用户在自己电脑上运行命令文件时，会自动下载这些内容。

### 文件夹结构

```text
Mac/         macOS 命令文件
Windows/     Windows 命令文件
AppFiles/    App 必需源码文件
```

### macOS 使用方法

双击：

```text
Mac/Mac.command
```

菜单功能：

- 安装依赖、下载模型并启动
- 仅启动
- 仅下载/更新 Whisper 模型
- 卸载生成文件和模型缓存

### Windows 使用方法

双击：

```text
Windows/Windows.bat
```

它会显示和 macOS 相同的菜单。

### 端口

- 前端页面：http://127.0.0.1:3001
- 后端 API：http://127.0.0.1:8000

### 模型

默认模型是 `base`，相比 `tiny` 首次体验和转写质量会更好。

如果想使用更轻或更大的模型，请在运行命令文件前设置 `WHISPER_MODEL`。

可用选项：

```text
tiny
base
small
```

本项目不需要任何付费 API。
