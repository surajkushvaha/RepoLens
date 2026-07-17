/// <reference lib="webworker" />
// Embedding worker. Runs the sentence-embedding model (all-MiniLM-L6-v2, 384-d,
// ~23MB, quantized) entirely in the browser via Transformers.js + WebAssembly,
// off the main thread so the UI never janks while a repo is being indexed.
//
// The model + wasm are fetched once from the HF/jsdelivr CDNs and then cached by
// the browser (Cache Storage), so subsequent visits load instantly and offline.
import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Pull weights from the Hub; we don't ship local model files.
env.allowLocalModels = false;

const MODEL = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline("feature-extraction", MODEL, {
    dtype: "q8", // quantized — smaller download, plenty accurate for retrieval
    progress_callback: (p: unknown) => post({ type: "status", payload: p }),
  });
  return extractorPromise;
}

type InMsg =
  | { type: "load" }
  | { type: "embed"; id: number; texts: string[] };

const post = (m: unknown, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(m, transfer ?? []);

// Embed a batch -> one normalized Float32 vector per input. normalize:true means
// cosine similarity reduces to a plain dot product downstream.
async function embed(texts: string[]): Promise<{ buffers: ArrayBuffer[]; dim: number }> {
  const extractor = await getExtractor();
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  const [n, dim] = out.dims as [number, number];
  const flat = out.data as Float32Array;
  const buffers: ArrayBuffer[] = [];
  for (let i = 0; i < n; i++) {
    const v = new Float32Array(dim);
    v.set(flat.subarray(i * dim, (i + 1) * dim));
    buffers.push(v.buffer);
  }
  return { buffers, dim };
}

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await getExtractor();
      post({ type: "ready", model: MODEL });
      return;
    }
    if (msg.type === "embed") {
      const { buffers, dim } = await embed(msg.texts);
      post({ type: "embedded", id: msg.id, buffers, dim }, buffers);
    }
  } catch (err) {
    post({
      type: "error",
      id: "id" in msg ? msg.id : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
