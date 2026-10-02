# 🎙 LocalVoiceAgent

**A real-time, local-first voice AI assistant for macOS.**

Listens to your laptop audio → transcribes locally → understands the question → searches the web when needed → answers using a local LLM → displays in a floating overlay.

**₹0 recurring cost. No paid AI APIs. 100% local processing.**

---

## ✨ Features

- **🎤 Real-time audio capture** — Microphone and system audio (via BlackHole)
- **🗣 Local speech-to-text** — whisper.cpp with Metal acceleration on Apple Silicon
- **🧠 Local LLM** — Ollama with configurable models (default: qwen2.5:3b)
- **🌐 Smart web search** — DuckDuckGo (no API key needed), only when current info is required
- **🔊 Text-to-speech** — macOS built-in `say` command
- **🪟 Floating overlay** — Always-on-top, transparent, draggable window
- **⌨️ Global shortcuts** — Toggle listening, show/hide, clear context
- **🔒 Privacy-first** — Audio never leaves your machine
- **📊 Debug panel** — Real-time latency metrics for each pipeline stage

## 📐 Architecture

```
System/Mic Audio → Audio Capture → VAD → whisper.cpp (STT)
     ↓
Transcript → Agent Router → Local LLM / Web Search + LLM
     ↓
Streaming Answer → Floating Overlay UI → Optional TTS
```

```
┌───────────────────────────────┐
│       Electron Desktop        │
│  ┌─────────────────────────┐  │
│  │   React Floating UI     │  │
│  └────────────┬────────────┘  │
│          WebSocket            │
│  ┌────────────▼────────────┐  │
│  │   Node.js Backend       │  │
│  │  ┌─────┐  ┌──────────┐ │  │
│  │  │ VAD │  │ whisper   │ │  │
│  │  └──┬──┘  │ .cpp STT │ │  │
│  │     │     └────┬─────┘ │  │
│  │     │    Agent Router   │  │
│  │     │    /         \    │  │
│  │   Local          Web    │  │
│  │   (Ollama)     Search   │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

## 🖥 Requirements

| Component | Version | Required |
|-----------|---------|----------|
| macOS | 12.3+ (Monterey) | ✅ |
| Apple Silicon | M1/M2/M3 | ✅ |
| Node.js | 18+ | ✅ |
| Ollama | Latest | ✅ |
| whisper.cpp | Latest | ✅ |
| BlackHole | 2ch | For system audio |
| FFmpeg | Latest | Optional |

**RAM**: Designed for 8GB. Uses ~4-5GB total (whisper tiny + qwen2.5:3b + Electron).

## 🚀 Installation

### 1. Clone the repository

```bash
cd /Users/you/Developer
git clone <repo-url> local-voice-agent
cd local-voice-agent
```

### 2. Run the setup script

```bash
./scripts/setup-macos.sh
```

This will check all dependencies and install npm packages.

### 3. Install Ollama

```bash
# Download from https://ollama.com/download
# Or:
brew install ollama
```

### 4. Pull a model

```bash
ollama serve  # Start Ollama (if not running)
ollama pull qwen2.5:3b  # Recommended for 8GB RAM
```

Other model options:
```bash
ollama pull llama3.2:3b  # Alternative 3B model
ollama pull phi3:mini     # Microsoft Phi-3 mini
ollama pull gemma2:2b     # Google Gemma 2B (smallest)
```

### 5. Install whisper.cpp

```bash
brew install whisper-cpp
```

Or build from source:
```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make -j
```

### 6. Download a whisper model

```bash
mkdir -p ~/.local/share/whisper-models
curl -L -o ~/.local/share/whisper-models/ggml-tiny.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
```

Model options:
| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| tiny.en | ~75MB | ⚡⚡⚡ | Good |
| base.en | ~140MB | ⚡⚡ | Better |
| small.en | ~460MB | ⚡ | Best |

### 7. System audio setup (optional)

To capture system audio (e.g., YouTube, Zoom):

```bash
brew install blackhole-2ch
```

Then:
1. Open **Audio MIDI Setup** (`/Applications/Utilities/Audio MIDI Setup.app`)
2. Click **+** → **Create Multi-Output Device**
3. Check both your speakers/headphones AND **BlackHole 2ch**
4. Set the Multi-Output Device as your system output in Sound settings
5. In LocalVoiceAgent Settings, select **BlackHole 2ch** as the audio source

### 8. macOS Permissions

The app will request:
- **Microphone**: Required for voice input
- **Screen Recording**: Required for system audio capture (if using desktopCapturer)

Grant these in **System Settings → Privacy & Security**.

## 🏃 Running

### Development mode

```bash
# Terminal 1: Start the backend
npm run dev:backend

# Terminal 2: Start the React UI (opens in browser for dev)
npm run dev:desktop
```

Or both together:
```bash
npm run dev
```

### Run with Electron

```bash
# Build and start Electron
cd apps/desktop
npm run dev:electron
```

### Production build

```bash
npm run build
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘⇧Space` | Toggle listening |
| `⌘⇧A` | Show/hide assistant |
| `⌘⇧C` | Clear conversation |
| `⌘⇧S` | Stop listening |

## 🧪 Testing

```bash
npm run test        # Run all tests
npm run typecheck   # Type checking
npm run lint        # Linting
```

## 🏗 Project Structure

```
local-voice-agent/
├── apps/
│   ├── backend/           # Node.js backend
│   │   └── src/
│   │       ├── audio/     # VAD
│   │       ├── stt/       # whisper.cpp STT
│   │       ├── llm/       # Ollama LLM
│   │       ├── agent/     # Router + context
│   │       ├── search/    # DuckDuckGo + retrieval
│   │       ├── tts/       # macOS TTS
│   │       └── websocket/ # WS server
│   └── desktop/           # Electron + React UI
│       ├── electron/      # Main process
│       └── src/           # React components
├── packages/
│   └── shared/            # Types & interfaces
├── scripts/
│   └── setup-macos.sh     # Setup script
└── docs/
```

## 🔧 Configuration

Copy `.env.example` to `.env` and modify:

```bash
cp .env.example .env
```

Key settings:
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
WHISPER_MODEL=tiny
BACKEND_PORT=3399
```

## 🔒 Privacy

- ✅ STT runs locally (whisper.cpp)
- ✅ LLM runs locally (Ollama)
- ✅ Audio never leaves your machine
- ✅ No paid AI API calls
- ⚠️ Web search queries go to DuckDuckGo (only when needed)
- ⚠️ Web page content is fetched for answers (only when needed)

## 🐛 Troubleshooting

### "Ollama is not running"
```bash
ollama serve
```

### "Whisper binary not found"
```bash
brew install whisper-cpp
# Or set WHISPER_BINARY_PATH in .env
```

### "No audio device found"
Check System Settings → Sound → Input. Ensure microphone is available.

### "System audio not capturing"
1. Install BlackHole: `brew install blackhole-2ch`
2. Create Multi-Output Device in Audio MIDI Setup
3. Select BlackHole as input in Settings

### High memory usage
- Use `qwen2.5:3b` or smaller model
- Use `tiny` whisper model
- Close unused applications

### Slow responses
- Use `tiny` whisper model (fastest)
- Use `qwen2.5:3b` (fast on M2)
- Reduce max tokens in Settings
- Disable web search for faster local answers

## 🛠 Performance Tuning

For M2 8GB:
- **STT**: Use `tiny.en` model (~75MB, <200ms)
- **LLM**: Use `qwen2.5:3b` (~2GB, 1-3s response)
- **VAD**: Adjust sensitivity to avoid false triggers
- **Context**: Keep to 10-20 turns to reduce LLM context size

## 📜 License

MIT
