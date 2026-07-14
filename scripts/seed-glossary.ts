import 'reflect-metadata';
import mongoose from 'mongoose';
import { Web3GlossarySchema } from '../src/database/schemas/web3-glossary.schema';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lumina';

const SEED_TERMS: {
  term: string;
  domainContext: string;
  localizedMappings?: Record<string, string>;
}[] = [
  { term: 'wallet', domainContext: 'WALLET', localizedMappings: { 'pt-BR': 'carteira', 'zh-CN': '钱包', fr: 'portefeuille' } },
  { term: 'slippage', domainContext: 'DEX', localizedMappings: { 'pt-BR': 'derrapagem de preço', 'zh-CN': '滑点', fr: 'glissement' } },
  { term: 'liquidity pool', domainContext: 'DEX', localizedMappings: { 'pt-BR': 'pool de liquidez', 'zh-CN': '流动性池', fr: 'pool de liquidité' } },
  { term: 'gas fee', domainContext: 'GENERAL', localizedMappings: { 'pt-BR': 'taxa de gas', 'zh-CN': 'Gas 费', fr: 'frais de gas' } },
  { term: 'staking', domainContext: 'GENERAL', localizedMappings: { 'pt-BR': 'staking', 'zh-CN': '质押', fr: 'staking' } },
  { term: 'bridge', domainContext: 'BRIDGE', localizedMappings: { 'pt-BR': 'ponte', 'zh-CN': '跨链桥', fr: 'pont' } },
  { term: 'yield farming', domainContext: 'DEX', localizedMappings: { 'pt-BR': 'yield farming', 'zh-CN': '流动性挖矿', fr: 'yield farming' } },
  { term: 'nft', domainContext: 'NFT', localizedMappings: { 'pt-BR': 'NFT', 'zh-CN': 'NFT', fr: 'NFT' } },
  { term: 'dao', domainContext: 'DAO', localizedMappings: { 'pt-BR': 'DAO', 'zh-CN': 'DAO', fr: 'DAO' } },
  { term: 'collateral', domainContext: 'LENDING', localizedMappings: { 'pt-BR': 'garantia', 'zh-CN': '抵押品', fr: 'garantie' } },
  { term: 'liquidation', domainContext: 'LENDING', localizedMappings: { 'pt-BR': 'liquidação', 'zh-CN': '清算', fr: 'liquidation' } },
];

async function main() {
  console.log(`Connecting to ${MONGODB_URI} ...`);
  await mongoose.connect(MONGODB_URI);
  const Web3Glossary = mongoose.model('Web3Glossary', Web3GlossarySchema, 'web3_glossary');

  for (const entry of SEED_TERMS) {
    await Web3Glossary.findOneAndUpdate(
      { term: entry.term },
      { $set: { domainContext: entry.domainContext, localizedMappings: entry.localizedMappings ?? {} } },
      { upsert: true },
    );
    console.log(`Seeded: ${entry.term}`);
  }

  console.log(`Done. Seeded ${SEED_TERMS.length} glossary terms.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
