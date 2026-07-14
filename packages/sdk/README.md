# `@lumina-ai/sdk`

Official zero-runtime-dependency TypeScript client for Lumina.

```bash
npm install @lumina-ai/sdk
```

```ts
import { LuminaClient } from '@lumina-ai/sdk';

const lumina = new LuminaClient({ apiKey: process.env.LUMINA_API_KEY! });
const result = await lumina.translateText({
  text: 'Swap {amount} ETH from {{wallet}}',
  targetLanguage: 'pt-BR',
});
```

Use the SDK from a trusted server or agent runtime. Never expose a long-lived Lumina API key in a browser bundle.

## Publishing

Publish locally with `npm publish --access public`. Trusted provenance is added
only by Lumina's GitHub release workflow because npm cannot generate automatic
provenance from a local terminal.
