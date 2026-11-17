import 'dotenv/config';
import { AI_MODELS, AI_PROVIDER_IDS } from '../src/config/aiModels.js';
import { GeminiProvider } from '../src/ai/providers/GeminiProvider.js';
import { OpenAIProvider } from '../src/ai/providers/OpenAIProvider.js';
import { registerSecrets } from '../src/utils/redact.js';

// Sends two fixed test strings through the REAL provider adapters using your real keys.
// Run it before deploying to confirm the key works and the model names in config/aiModels.ts are valid.
const keys = { gemini: process.env.GEMINI_API_KEY, openai: process.env.OPENAI_API_KEY };
registerSecrets(Object.values(keys).filter((k): k is string => !!k));
const providers = { gemini: new GeminiProvider(keys.gemini), openai: new OpenAIProvider(keys.openai) };
const samples = ['Hello everyone, hope you are having a great day!', 'You are a worthless idiot and everyone hates you, just disappear.'];
const only = process.argv[2];
let failed = false;

for (const id of AI_PROVIDER_IDS) {
  if (only && only !== id) continue;
  const provider = providers[id];
  if (!provider.isConfigured()) { console.log(`[${id}] skipped: no API key`); continue; }
  const model = process.argv[3] ?? AI_MODELS[id].default;
  for (const text of samples) {
    const r = await provider.classify({ text, model, timeoutMs: 15_000 });
    if (r.ok) {
      const top = Object.entries(r.scores).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(' ');
      console.log(`[${id}/${model}] OK ${r.latencyMs}ms confidence=${r.confidence.toFixed(2)} top: ${top}  <- "${text.slice(0, 40)}…"`);
    } else {
      failed = true;
      console.log(`[${id}/${model}] FAILED reason=${r.reason} ${r.detail ?? ''}`);
    }
  }
}
process.exit(failed ? 1 : 0);
