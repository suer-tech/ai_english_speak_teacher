const TARGET_SAMPLE_RATE = 16000;
const SPEECH_RMS_THRESHOLD = 0.016;
const SILENCE_HOLD_MS = 450;

export interface PcmCaptureCallbacks {
  onPcmChunk: (chunk: Uint8Array) => void;
  onSpeechActivityChange?: (isSpeechActive: boolean) => void;
}

function floatToInt16(value: number) {
  const clamped = Math.max(-1, Math.min(1, value));
  return clamped < 0 ? Math.floor(clamped * 0x8000) : Math.floor(clamped * 0x7fff);
}

function concatFloat32Arrays(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

class Pcm16Resampler {
  private readonly ratio: number;
  private remainder = new Float32Array(0);

  constructor(
    private readonly sourceSampleRate: number,
    private readonly targetSampleRate: number,
  ) {
    this.ratio = sourceSampleRate / targetSampleRate;
  }

  process(input: Float32Array) {
    const merged = this.remainder.length
      ? concatFloat32Arrays([this.remainder, input])
      : input;

    if (this.sourceSampleRate === this.targetSampleRate) {
      this.remainder = new Float32Array(0);
      return this.encodeChunk(merged);
    }

    const outputLength = Math.floor(merged.length / this.ratio);
    if (outputLength <= 0) {
      this.remainder = merged;
      return null;
    }

    const output = new Int16Array(outputLength);
    const outputFloat = new Float32Array(outputLength);
    let sourceOffset = 0;

    for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
      const nextSourceOffset = Math.min(
        merged.length,
        Math.round((outputIndex + 1) * this.ratio),
      );

      let accum = 0;
      let count = 0;
      const boundedOffset = Math.min(Math.floor(sourceOffset), merged.length - 1);

      for (let inputIndex = boundedOffset; inputIndex < nextSourceOffset; inputIndex += 1) {
        accum += merged[inputIndex];
        count += 1;
      }

      const averaged = count > 0 ? accum / count : merged[boundedOffset] ?? 0;
      outputFloat[outputIndex] = averaged;
      output[outputIndex] = floatToInt16(averaged);
      sourceOffset = nextSourceOffset;
    }

    this.remainder = merged.slice(sourceOffset);

    return {
      pcmChunk: new Uint8Array(output.buffer.slice(0)),
      rms: this.calculateRms(outputFloat),
    };
  }

  private encodeChunk(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let index = 0; index < input.length; index += 1) {
      output[index] = floatToInt16(input[index]);
    }

    return {
      pcmChunk: new Uint8Array(output.buffer.slice(0)),
      rms: this.calculateRms(input),
    };
  }

  private calculateRms(input: Float32Array) {
    if (!input.length) {
      return 0;
    }

    let sum = 0;
    for (let index = 0; index < input.length; index += 1) {
      sum += input[index] * input[index];
    }

    return Math.sqrt(sum / input.length);
  }
}

export class PcmCaptureSession {
  readonly sampleRate = TARGET_SAMPLE_RATE;

  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentSink: GainNode | null = null;
  private resampler: Pcm16Resampler | null = null;
  private isSpeechActive = false;
  private lastSpeechAt = 0;

  constructor(private readonly callbacks: PcmCaptureCallbacks) {}

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        noiseSuppression: { ideal: true },
        echoCancellation: { ideal: true },
        autoGainControl: { ideal: true },
      },
    });
    this.mediaStream = stream;

    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      throw new Error("AudioContext not supported");
    }

    const audioContext = new AudioContextConstructor();
    this.audioContext = audioContext;
    this.resampler = new Pcm16Resampler(audioContext.sampleRate, TARGET_SAMPLE_RATE);

    await audioContext.audioWorklet.addModule(
      new URL("./pcmCaptureWorklet.js", import.meta.url).href,
    );

    const source = audioContext.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioContext, "pcm-capture-processor");
    const silentSink = audioContext.createGain();
    silentSink.gain.value = 0;

    workletNode.port.onmessage = (event) => {
      const buffer = event.data;
      if (!(buffer instanceof ArrayBuffer) || !this.resampler) {
        return;
      }

      const chunk = new Float32Array(buffer);
      const resampled = this.resampler.process(chunk);
      if (!resampled?.pcmChunk.length) {
        return;
      }

      this.callbacks.onPcmChunk(resampled.pcmChunk);
      this.updateSpeechActivity(resampled.rms);
    };

    source.connect(workletNode);
    workletNode.connect(silentSink);
    silentSink.connect(audioContext.destination);
    await audioContext.resume();

    this.audioSource = source;
    this.workletNode = workletNode;
    this.silentSink = silentSink;
  }

  async stop() {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }

    if (this.silentSink) {
      this.silentSink.disconnect();
      this.silentSink = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.resampler = null;
    this.lastSpeechAt = 0;
    this.isSpeechActive = false;
  }

  private updateSpeechActivity(rms: number) {
    const now = performance.now();
    if (rms >= SPEECH_RMS_THRESHOLD) {
      this.lastSpeechAt = now;
      if (!this.isSpeechActive) {
        this.isSpeechActive = true;
        this.callbacks.onSpeechActivityChange?.(true);
      }
      return;
    }

    if (
      this.isSpeechActive &&
      this.lastSpeechAt > 0 &&
      now - this.lastSpeechAt >= SILENCE_HOLD_MS
    ) {
      this.isSpeechActive = false;
      this.callbacks.onSpeechActivityChange?.(false);
    }
  }
}

export { TARGET_SAMPLE_RATE };
