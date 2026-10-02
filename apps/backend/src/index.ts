import { WSServer } from './websocket/index.js';
import { OllamaProvider } from './llm/index.js';
import { WhisperCppProvider } from './stt/index.js';
import { AgentRouter, ConversationContext } from './agent/index.js';
import { DuckDuckGoProvider, WebRetriever } from './search/index.js';
import { MacOSTTSProvider } from './tts/index.js';
import { EnergyVAD } from './audio/index.js';
import { defaultSettings, serverConfig } from './config.js';
import { createLogger } from './logger.js';
import type {
  ClientEvent,
  AudioDataEvent,
  SettingsUpdateEvent,
  AnswerSource,
} from '@local-voice-agent/shared';
import { WebSocket } from 'ws';

const log = createLogger('main');

// ─── Initialize Components ────────────────────────────────────────

const ws = new WSServer();
const settings = { ...defaultSettings };

// LLM
const ollama = new OllamaProvider(
  settings.llm.url,
  settings.llm.model,
  settings.llm.temperature,
  settings.llm.maxTokens,
);

// STT
const whisper = new WhisperCppProvider(
  settings.stt.binaryPath,
  settings.stt.modelsDir,
  settings.stt.model,
  settings.stt.language,
);

// Agent
const router = new AgentRouter(ollama);
const context = new ConversationContext(settings.context.maxTurns);

// Search
const searchProvider = new DuckDuckGoProvider(
  settings.search.maxResults,
  settings.search.timeoutMs,
);
const retriever = new WebRetriever();

// TTS
const tts = new MacOSTTSProvider(settings.tts.voice, settings.tts.speed);

// VAD
const vad = new EnergyVAD({
  sensitivity: settings.audio.vadSensitivity,
  silenceTimeoutMs: settings.audio.silenceTimeoutMs,
});

// ─── State ─────────────────────────────────────────────────────────

let isListening = false;
let isProcessing = false;
let audioBuffer: Buffer[] = [];
let processingQueue: Promise<void> = Promise.resolve();

// ─── VAD Callbacks ─────────────────────────────────────────────────

vad.onSpeechStartCallback(() => {
  log.debug('VAD: speech started');
  ws.broadcast({ type: 'status.update', listening: isListening, processing: isProcessing, vadActive: true });
});

vad.onSpeechEndCallback(async (duration: number) => {
  log.debug(`VAD: speech ended (${duration}ms)`);
  ws.broadcast({ type: 'status.update', listening: isListening, processing: isProcessing, vadActive: false });

  // Process accumulated audio
  if (audioBuffer.length > 0) {
    const fullAudio = Buffer.concat(audioBuffer);
    audioBuffer = [];

    // Queue processing to avoid parallel transcriptions
    processingQueue = processingQueue.then(() => processAudioChunk(fullAudio));
  }
});

// ─── Audio Processing Pipeline ─────────────────────────────────────

async function processAudioChunk(audio: Buffer): Promise<void> {
  if (!isListening || audio.length === 0) return;

  isProcessing = true;
  ws.broadcast({ type: 'status.update', listening: isListening, processing: true, vadActive: false });

  const pipelineStart = Date.now();

  try {
    // Step 1: Transcribe
    const sttStart = Date.now();
    const transcript = await whisper.transcribe(audio, settings.audio.sampleRate);
    const sttLatency = Date.now() - sttStart;

    if (!transcript.text || transcript.text.length < 3) {
      log.debug('Empty/too-short transcript, skipping');
      return;
    }

    // Broadcast transcript
    ws.broadcast({
      type: 'transcript.final',
      text: transcript.text,
      timestamp: Date.now(),
    });

    ws.broadcast({
      type: 'metrics.update',
      sttLatencyMs: sttLatency,
      vadState: vad.getState(),
    });

    // Step 2: Route
    const decision = await router.route(transcript.text);
    log.info(`Router: "${transcript.text.substring(0, 50)}..." → ${decision.action} (${decision.reason})`);

    if (decision.action === 'ignore') {
      return;
    }

    // Step 3: Add to context
    context.addUserMessage(transcript.text);

    // Step 4: Generate answer
    ws.broadcast({
      type: 'answer.start',
      action: decision.action,
      reason: decision.reason,
    });

    if (decision.action === 'web_search' && settings.search.enabled) {
      await handleWebSearch(decision.searchQuery || transcript.text, sttLatency, pipelineStart);
    } else {
      await handleLocalAnswer(sttLatency, pipelineStart);
    }

  } catch (error) {
    log.error('Pipeline error', { error: (error as Error).message });
    ws.broadcast({
      type: 'error',
      code: 'pipeline_error',
      message: `Processing failed: ${(error as Error).message}`,
    });
  } finally {
    isProcessing = false;
    ws.broadcast({ type: 'status.update', listening: isListening, processing: false, vadActive: false });
  }
}

async function handleLocalAnswer(sttLatency: number, pipelineStart: number): Promise<void> {
  const llmStart = Date.now();
  let fullAnswer = '';

  try {
    for await (const chunk of ollama.chat(context.getMessages())) {
      fullAnswer += chunk;
      ws.broadcast({ type: 'answer.delta', text: chunk });
    }

    const llmLatency = Date.now() - llmStart;
    context.addAssistantMessage(fullAnswer);

    ws.broadcast({
      type: 'answer.complete',
      text: fullAnswer,
      sources: [],
      action: 'local_answer',
      duration: Date.now() - pipelineStart,
    });

    ws.broadcast({
      type: 'metrics.update',
      sttLatencyMs: sttLatency,
      llmLatencyMs: llmLatency,
      totalLatencyMs: Date.now() - pipelineStart,
    });

    // TTS
    if (settings.tts.enabled && fullAnswer.length > 0) {
      tts.speak(fullAnswer).catch(err => log.error('TTS error', { error: err.message }));
    }
  } catch (error) {
    const err = error as Error;
    if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
      ws.broadcast({
        type: 'error',
        code: 'ollama_unavailable',
        message: 'Ollama is not running. Start Ollama and try again.',
        details: 'Run: ollama serve',
      });
    } else {
      throw error;
    }
  }
}

async function handleWebSearch(query: string, sttLatency: number, pipelineStart: number): Promise<void> {
  const sources: AnswerSource[] = [];

  try {
    // Search
    ws.broadcast({ type: 'search.progress', stage: 'searching', message: `Searching for: ${query}` });
    const searchStart = Date.now();
    const results = await searchProvider.search(query);
    const searchLatency = Date.now() - searchStart;

    if (results.length === 0) {
      log.warn('No search results, falling back to local answer');
      await handleLocalAnswer(sttLatency, pipelineStart);
      return;
    }

    // Retrieve content
    ws.broadcast({ type: 'search.progress', stage: 'reading', message: 'Reading sources...' });
    const contents = await retriever.retrieve(results, 3);

    sources.push(...contents.map(c => ({ title: c.title, url: c.url })));

    // Build context with web results
    const webContext = retriever.formatForLLM(contents);
    const messages = context.getMessagesWithContext(webContext);

    // Generate answer with web context
    ws.broadcast({ type: 'search.progress', stage: 'analyzing', message: 'Analyzing results...' });
    const llmStart = Date.now();
    let fullAnswer = '';

    for await (const chunk of ollama.chat(messages)) {
      fullAnswer += chunk;
      ws.broadcast({ type: 'answer.delta', text: chunk });
    }

    const llmLatency = Date.now() - llmStart;
    context.addAssistantMessage(fullAnswer);

    ws.broadcast({
      type: 'answer.complete',
      text: fullAnswer,
      sources,
      action: 'web_search',
      duration: Date.now() - pipelineStart,
    });

    ws.broadcast({
      type: 'metrics.update',
      sttLatencyMs: sttLatency,
      llmLatencyMs: llmLatency,
      searchLatencyMs: searchLatency,
      totalLatencyMs: Date.now() - pipelineStart,
    });

    // TTS
    if (settings.tts.enabled && fullAnswer.length > 0) {
      tts.speak(fullAnswer).catch(err => log.error('TTS error', { error: err.message }));
    }
  } catch (error) {
    log.error('Web search failed, falling back to local', { error: (error as Error).message });
    ws.broadcast({
      type: 'error',
      code: 'search_failed',
      message: 'Internet unavailable. Answering with local knowledge.',
    });
    await handleLocalAnswer(sttLatency, pipelineStart);
  }
}

// ─── Diagnostics ───────────────────────────────────────────────────

async function runDiagnostics(): Promise<Record<string, { status: string; message?: string }>> {
  const results: Record<string, { status: string; message?: string }> = {};

  // Ollama
  try {
    const available = await ollama.isAvailable();
    results.ollama = available
      ? { status: 'ok', message: `Connected to ${settings.llm.url}` }
      : { status: 'error', message: 'Ollama is not running' };
  } catch {
    results.ollama = { status: 'error', message: 'Cannot connect to Ollama' };
  }

  // LLM Model
  if (results.ollama.status === 'ok') {
    try {
      const models = await ollama.listModels();
      const hasModel = models.some(m => m.includes(settings.llm.model.split(':')[0]));
      results.llmModel = hasModel
        ? { status: 'ok', message: `Model ${settings.llm.model} available` }
        : { status: 'error', message: `Model ${settings.llm.model} not found. Run: ollama pull ${settings.llm.model}` };
    } catch {
      results.llmModel = { status: 'error', message: 'Could not list models' };
    }
  } else {
    results.llmModel = { status: 'error', message: 'Ollama not available' };
  }

  // Whisper
  results.whisper = whisper.isReady()
    ? { status: 'ok', message: `${whisper.getModelInfo().name} ready` }
    : { status: 'error', message: 'Whisper not configured. See setup instructions.' };

  // Internet
  try {
    const available = await searchProvider.isAvailable();
    results.internet = available
      ? { status: 'ok', message: 'Internet available' }
      : { status: 'error', message: 'No internet connection' };
  } catch {
    results.internet = { status: 'error', message: 'Cannot check internet' };
  }

  // Audio (will be checked from the client side)
  results.audio = { status: 'unknown', message: 'Check from the desktop app' };
  results.systemAudio = { status: 'unknown', message: 'Check from the desktop app' };
  results.microphone = { status: 'unknown', message: 'Check from the desktop app' };

  return results;
}

// ─── WebSocket Event Handlers ──────────────────────────────────────

ws.on('audio.data', (event: ClientEvent) => {
  if (!isListening) return;
  const audioEvent = event as AudioDataEvent;
  try {
    const buffer = Buffer.from(audioEvent.data, 'base64');

    // Run through VAD
    vad.processChunk(buffer);

    // Accumulate audio during speech
    if (vad.getState() === 'speech') {
      audioBuffer.push(buffer);
    }
  } catch (err) {
    log.error('Audio data processing error', { error: (err as Error).message });
  }
});

ws.on('control.start', () => {
  log.info('Listening started');
  isListening = true;
  audioBuffer = [];
  vad.reset();
  ws.broadcast({ type: 'status.update', listening: true, processing: false, vadActive: false, message: 'Listening...' });
});

ws.on('control.stop', () => {
  log.info('Listening stopped');
  isListening = false;
  audioBuffer = [];
  vad.reset();
  ws.broadcast({ type: 'status.update', listening: false, processing: false, vadActive: false, message: 'Stopped' });
});

ws.on('control.clear', () => {
  log.info('Context cleared');
  context.clear();
  ws.broadcast({ type: 'status.update', listening: isListening, processing: false, vadActive: false, message: 'Context cleared' });
});

ws.on('control.pause', () => {
  isListening = false;
  ws.broadcast({ type: 'status.update', listening: false, processing: false, vadActive: false, message: 'Paused' });
});

ws.on('control.resume', () => {
  isListening = true;
  ws.broadcast({ type: 'status.update', listening: true, processing: false, vadActive: false, message: 'Listening...' });
});

ws.on('settings.update', (event: ClientEvent) => {
  const settingsEvent = event as SettingsUpdateEvent;
  const newSettings = settingsEvent.settings;
  log.info('Settings updated', { keys: Object.keys(newSettings) });

  // Apply settings updates
  if (newSettings.llm) {
    const llmSettings = newSettings.llm as Record<string, unknown>;
    if (llmSettings.model) ollama.setModel(llmSettings.model as string);
    if (llmSettings.temperature !== undefined) ollama.setTemperature(llmSettings.temperature as number);
    if (llmSettings.maxTokens !== undefined) ollama.setMaxTokens(llmSettings.maxTokens as number);
  }

  if (newSettings.audio) {
    const audioSettings = newSettings.audio as Record<string, unknown>;
    if (audioSettings.vadSensitivity !== undefined) vad.setSensitivity(audioSettings.vadSensitivity as number);
    if (audioSettings.silenceTimeoutMs !== undefined) vad.setSilenceTimeout(audioSettings.silenceTimeoutMs as number);
  }

  if (newSettings.context) {
    const ctxSettings = newSettings.context as Record<string, unknown>;
    if (ctxSettings.maxTurns !== undefined) context.setMaxTurns(ctxSettings.maxTurns as number);
  }

  if (newSettings.tts) {
    const ttsSettings = newSettings.tts as Record<string, unknown>;
    if (ttsSettings.enabled !== undefined) settings.tts.enabled = ttsSettings.enabled as boolean;
    if (ttsSettings.voice) tts.setVoice(ttsSettings.voice as string);
    if (ttsSettings.speed !== undefined) tts.setSpeed(ttsSettings.speed as number);
  }
});

ws.on('diagnostics.request', async (_event: ClientEvent, client: WebSocket) => {
  const diagnostics = await runDiagnostics();
  ws.send(client, { type: 'diagnostics.response', diagnostics });
});

// ─── Start ─────────────────────────────────────────────────────────

async function main() {
  log.info('┌─────────────────────────────────────┐');
  log.info('│       LocalVoiceAgent Backend        │');
  log.info('└─────────────────────────────────────┘');

  // Initialize STT
  await whisper.initialize();

  // Check Ollama
  const ollamaAvailable = await ollama.isAvailable();
  if (ollamaAvailable) {
    log.info(`Ollama connected: ${settings.llm.url}`);
    const models = await ollama.listModels();
    log.info(`Available models: ${models.join(', ') || 'none'}`);
  } else {
    log.warn('Ollama is not running. Start it with: ollama serve');
  }

  // Start WebSocket server
  await ws.start(serverConfig.port, serverConfig.host);

  log.info('Backend ready. Waiting for desktop client...');
  log.info(`Connect at: ws://${serverConfig.host}:${serverConfig.port}`);
}

main().catch((error) => {
  log.error('Fatal error', { error: error.message });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  log.info('Shutting down...');
  await ws.stop();
  await whisper.dispose();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await ws.stop();
  await whisper.dispose();
  process.exit(0);
});
