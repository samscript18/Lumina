import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.local' });

async function main() {
  const apiKey = process.env.RENDER_API_KEY, serviceId = process.env.RENDER_SERVICE_ID, deployId = process.env.RENDER_ROLLBACK_DEPLOY_ID;
  if (!apiKey || !serviceId || !deployId) throw new Error('RENDER_API_KEY, RENDER_SERVICE_ID, and RENDER_ROLLBACK_DEPLOY_ID are required');
  if (process.env.RENDER_ROLLBACK_CONFIRM !== deployId) throw new Error('Set RENDER_ROLLBACK_CONFIRM to the exact target deploy ID');
  const response = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/rollback`, {
    method: 'POST', headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ deployId }), signal: AbortSignal.timeout(30_000),
  });
  if (response.status !== 201) throw new Error(`Render rollback failed with HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  console.log(JSON.stringify({ rollbackStarted: true, serviceId, deployId }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
