/// <reference lib="webworker" />
import { makeMusic, type MusicTheme } from './audio-music';

const worker = globalThis as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = ({ data }: MessageEvent<MusicTheme>) => {
  const music = makeMusic(data);
  worker.postMessage(music, [music.samples.buffer]);
};
