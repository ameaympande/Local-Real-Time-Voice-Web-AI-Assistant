# Architecture Overview

## Pipeline

```
System Audio / Microphone
         │
         ▼
    Audio Capture (Web Audio API / desktopCapturer)
         │
         ▼
    Voice Activity Detection (Energy-based VAD)
         │
         ▼
    Speech-to-Text (whisper.cpp)
         │
         ▼
    Agent Router (heuristic + optional LLM)
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Local     Web Search
  Answer    (DuckDuckGo)
    │         │
    │    Content Retrieval
    │         │
    │    ┌────┘
    ▼    ▼
    Local LLM (Ollama)
         │
         ▼
    Streaming Answer
         │
         ▼
    Floating Overlay UI
         │
         ▼
    Optional TTS (macOS say)
```

## Components

### Audio Capture
- **Microphone**: Web Audio API (`getUserMedia`)
- **System Audio**: Electron `desktopCapturer` or BlackHole virtual device
- **Format**: 16kHz mono Float32

### Voice Activity Detection (VAD)
- **Type**: Energy-based (RMS threshold)
- **Features**: Adaptive noise floor, configurable sensitivity
- **Purpose**: Avoid sending silence to STT, detect speech boundaries

### Speech-to-Text (STT)
- **Provider**: whisper.cpp (C++ binary via child_process)
- **Models**: tiny.en (75MB), base.en (140MB), small.en (460MB)
- **Latency**: ~100-300ms for tiny model on M2
- **Interface**: `STTProvider` (swappable)

### Agent Router
- **Fast heuristic-based routing**: Pattern matching for questions vs casual speech
- **Current info detection**: Keywords like "latest", "current", "today", years
- **Optional LLM routing**: For ambiguous cases
- **Decisions**: `local_answer` | `web_search` | `ignore`

### LLM Provider (Ollama)
- **API**: Ollama HTTP API with streaming
- **Default model**: qwen2.5:3b (~2GB)
- **Interface**: `LLMProvider` (swappable)
- **Streaming**: Token-by-token via NDJSON

### Web Search
- **Provider**: DuckDuckGo HTML Lite
- **No API key required**
- **Rate limited**: 2s between requests
- **Interface**: `SearchProvider` (swappable)

### Web Retrieval
- **Fetches top 3 results**
- **Extracts text content** (removes scripts, styles, nav, etc.)
- **Truncates to 5000 chars total** to fit LLM context
- **Formats with source URLs** for attribution

### Conversation Context
- **Sliding window**: Configurable max turns (default 20)
- **System prompt**: Concise voice assistant persona
- **Web context injection**: Additional system message with search results

### TTS
- **Provider**: macOS `say` command
- **Zero dependencies**
- **Interface**: `TTSProvider` (swappable)

## Communication

### WebSocket Protocol

All communication between desktop UI and backend uses WebSocket JSON messages.

#### Client → Server
- `audio.data` — Base64-encoded audio chunk
- `control.start/stop/clear/pause/resume` — Control commands
- `settings.update` — Settings changes
- `diagnostics.request` — Request system diagnostics

#### Server → Client
- `transcript.partial/final` — Transcription results
- `answer.start/delta/complete` — Streamed answer
- `search.progress` — Web search status
- `status.update` — System state
- `metrics.update` — Performance metrics
- `error` — Error messages
- `diagnostics.response` — System health check

## Extensibility

Provider interfaces allow swapping implementations:

```typescript
interface AudioProvider { ... }
interface STTProvider { ... }
interface LLMProvider { ... }
interface SearchProvider { ... }
interface TTSProvider { ... }
```

Future providers can implement these interfaces without changing the pipeline.
