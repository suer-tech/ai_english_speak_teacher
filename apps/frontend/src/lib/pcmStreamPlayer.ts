const PCM_BYTES_PER_SAMPLE = 2;
const INITIAL_BUFFER_SECONDS = 0.08;
const STREAM_BUFFER_SECONDS = 0.02;

type PlaybackCallbacks = {
  onPlaybackStart?: () => void;
};

function concatUint8Arrays(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function pcm16ToFloat32(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = Math.floor(bytes.byteLength / PCM_BYTES_PER_SAMPLE);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = view.getInt16(index * PCM_BYTES_PER_SAMPLE, true);
    samples[index] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }

  return samples;
}

export class PcmStreamPlayer {
  private readonly sampleRate: number;
  private readonly callbacks: PlaybackCallbacks;
  private audioContext: AudioContext | null = null;
  private scheduledThroughTime = 0;
  private started = false;
  private stopped = false;
  private activeSources = new Set<AudioBufferSourceNode>();

  constructor(sampleRate: number, callbacks: PlaybackCallbacks = {}) {
    this.sampleRate = sampleRate;
    this.callbacks = callbacks;
  }

  async play(stream: ReadableStream<Uint8Array>, signal?: AbortSignal) {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      throw new Error("AudioContext not supported");
    }

    this.audioContext = new AudioContextConstructor();
    await this.audioContext.resume();
    this.scheduledThroughTime = this.audioContext.currentTime;

    const reader = stream.getReader();
    let remainder = new Uint8Array(0);

    try {
      while (!this.stopped) {
        if (signal?.aborted) {
          throw new DOMException("Playback aborted", "AbortError");
        }

        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!value?.length) {
          continue;
        }

        const combined = remainder.length ? concatUint8Arrays([remainder, value]) : value;
        const evenLength = combined.byteLength - (combined.byteLength % PCM_BYTES_PER_SAMPLE);
        remainder = evenLength < combined.byteLength ? combined.slice(evenLength) : new Uint8Array(0);

        if (evenLength === 0) {
          continue;
        }

        this.scheduleChunk(combined.slice(0, evenLength));
      }

      if (!this.started) {
        throw new Error("Empty audio stream");
      }

      const remainingMs = Math.max(
        0,
        (this.scheduledThroughTime - (this.audioContext?.currentTime ?? 0)) * 1000,
      );

      if (remainingMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingMs + 40));
      }
    } finally {
      reader.releaseLock();
      await this.dispose();
    }
  }

  async stop() {
    this.stopped = true;
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // ignore stop errors for already finished sources
      }
    }

    await this.dispose();
  }

  private scheduleChunk(chunk: Uint8Array) {
    if (!this.audioContext) {
      throw new Error("AudioContext is not ready");
    }

    const samples = pcm16ToFloat32(chunk);
    if (samples.length === 0) {
      return;
    }

    const buffer = this.audioContext.createBuffer(1, samples.length, this.sampleRate);
    buffer.copyToChannel(samples, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.onended = () => {
      this.activeSources.delete(source);
    };
    this.activeSources.add(source);

    const leadIn = this.started ? STREAM_BUFFER_SECONDS : INITIAL_BUFFER_SECONDS;
    const startAt = Math.max(this.audioContext.currentTime + leadIn, this.scheduledThroughTime);
    source.start(startAt);
    this.scheduledThroughTime = startAt + buffer.duration;

    if (!this.started) {
      this.started = true;
      this.callbacks.onPlaybackStart?.();
    }
  }

  private async dispose() {
    const context = this.audioContext;
    this.audioContext = null;
    this.activeSources.clear();

    if (context && context.state !== "closed") {
      await context.close();
    }
  }
}
