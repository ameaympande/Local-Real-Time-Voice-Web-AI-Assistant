#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# LocalVoiceAgent — macOS Setup Script
# ═══════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     LocalVoiceAgent — macOS Setup         ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ─── Check Node.js ──────────────────────────────────────────────────
echo -e "${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo -e "  ${GREEN}✓${NC} Node.js ${NODE_VERSION}"
  
  # Check minimum version (18+)
  MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
  if [ "$MAJOR" -lt 18 ]; then
    echo -e "  ${RED}✗${NC} Node.js 18+ required. Current: ${NODE_VERSION}"
    echo -e "  ${YELLOW}→ Install with: brew install node${NC}"
    exit 1
  fi
else
  echo -e "  ${RED}✗${NC} Node.js not found"
  echo -e "  ${YELLOW}→ Install with: brew install node${NC}"
  exit 1
fi

# ─── Check npm ──────────────────────────────────────────────────────
echo -e "${BLUE}Checking npm...${NC}"
if command -v npm &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} npm $(npm --version)"
else
  echo -e "  ${RED}✗${NC} npm not found"
  exit 1
fi

# ─── Check Ollama ───────────────────────────────────────────────────
echo -e "${BLUE}Checking Ollama...${NC}"
if command -v ollama &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} Ollama found"
  
  # Check if Ollama is running
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Ollama is running"
    
    # Check for model
    MODELS=$(curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | head -5)
    echo -e "  ${CYAN}Models:${NC} ${MODELS}"
  else
    echo -e "  ${YELLOW}!${NC} Ollama is not running"
    echo -e "  ${YELLOW}→ Start with: ollama serve${NC}"
  fi
else
  echo -e "  ${RED}✗${NC} Ollama not found"
  echo -e "  ${YELLOW}→ Install from: https://ollama.com/download${NC}"
  echo -e "  ${YELLOW}→ Or: brew install ollama${NC}"
fi

# ─── Check whisper.cpp ──────────────────────────────────────────────
echo -e "${BLUE}Checking whisper.cpp...${NC}"
WHISPER_FOUND=false

if command -v whisper-cpp &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} whisper-cpp found ($(which whisper-cpp))"
  WHISPER_FOUND=true
elif [ -f "/opt/homebrew/bin/whisper-cpp" ]; then
  echo -e "  ${GREEN}✓${NC} whisper-cpp found (/opt/homebrew/bin/whisper-cpp)"
  WHISPER_FOUND=true
elif [ -f "$HOME/whisper.cpp/main" ]; then
  echo -e "  ${GREEN}✓${NC} whisper.cpp found ($HOME/whisper.cpp/main)"
  WHISPER_FOUND=true
fi

if [ "$WHISPER_FOUND" = false ]; then
  echo -e "  ${YELLOW}!${NC} whisper.cpp not found"
  echo -e "  ${YELLOW}→ Install with: brew install whisper-cpp${NC}"
  echo -e "  ${YELLOW}→ Or build from source:${NC}"
  echo -e "  ${YELLOW}    git clone https://github.com/ggerganov/whisper.cpp.git${NC}"
  echo -e "  ${YELLOW}    cd whisper.cpp && make -j${NC}"
fi

# ─── Check whisper model ───────────────────────────────────────────
echo -e "${BLUE}Checking whisper model...${NC}"
MODELS_DIR="$HOME/.local/share/whisper-models"
if [ -f "$MODELS_DIR/ggml-tiny.en.bin" ]; then
  echo -e "  ${GREEN}✓${NC} tiny.en model found"
elif [ -f "$MODELS_DIR/ggml-base.en.bin" ]; then
  echo -e "  ${GREEN}✓${NC} base.en model found"
else
  echo -e "  ${YELLOW}!${NC} No whisper model found"
  echo -e "  ${YELLOW}→ Download the tiny model:${NC}"
  echo -e "  ${YELLOW}    mkdir -p $MODELS_DIR${NC}"
  echo -e "  ${YELLOW}    curl -L -o $MODELS_DIR/ggml-tiny.en.bin \\${NC}"
  echo -e "  ${YELLOW}      https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin${NC}"
fi

# ─── Check FFmpeg ───────────────────────────────────────────────────
echo -e "${BLUE}Checking FFmpeg...${NC}"
if command -v ffmpeg &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} FFmpeg found"
else
  echo -e "  ${YELLOW}!${NC} FFmpeg not found (optional, for audio conversion)"
  echo -e "  ${YELLOW}→ Install with: brew install ffmpeg${NC}"
fi

# ─── System Audio (BlackHole) ───────────────────────────────────────
echo -e "${BLUE}Checking system audio capture...${NC}"
if system_profiler SPAudioDataType 2>/dev/null | grep -q "BlackHole"; then
  echo -e "  ${GREEN}✓${NC} BlackHole audio device found"
else
  echo -e "  ${YELLOW}!${NC} BlackHole not found (needed for system audio capture)"
  echo -e "  ${YELLOW}→ Install BlackHole 2ch:${NC}"
  echo -e "  ${YELLOW}    brew install blackhole-2ch${NC}"
  echo -e "  ${YELLOW}→ Then create a Multi-Output Device in Audio MIDI Setup:${NC}"
  echo -e "  ${YELLOW}    1. Open /Applications/Utilities/Audio MIDI Setup.app${NC}"
  echo -e "  ${YELLOW}    2. Click '+' → Create Multi-Output Device${NC}"
  echo -e "  ${YELLOW}    3. Check both your speakers and BlackHole 2ch${NC}"
  echo -e "  ${YELLOW}    4. Set the Multi-Output Device as your system output${NC}"
  echo -e "  ${YELLOW}    5. In LocalVoiceAgent, select BlackHole 2ch as input${NC}"
fi

# ─── Install Dependencies ──────────────────────────────────────────
echo ""
echo -e "${BLUE}Installing npm dependencies...${NC}"
npm install

# ─── Build shared package ──────────────────────────────────────────
echo ""
echo -e "${BLUE}Building shared package...${NC}"
npm run build:shared

# ─── Summary ────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo -e "To start the application:"
echo ""
echo -e "  ${BOLD}1. Start Ollama (if not running):${NC}"
echo -e "     ollama serve"
echo ""
echo -e "  ${BOLD}2. Pull a model (first time only):${NC}"
echo -e "     ollama pull qwen2.5:3b"
echo ""
echo -e "  ${BOLD}3. Start the backend:${NC}"
echo -e "     npm run dev:backend"
echo ""
echo -e "  ${BOLD}4. Start the desktop app (new terminal):${NC}"
echo -e "     npm run dev:desktop"
echo ""
echo -e "  ${BOLD}Or start both together:${NC}"
echo -e "     npm run dev"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
