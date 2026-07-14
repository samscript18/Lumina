import { BadRequestException } from '@nestjs/common';
import { ContextParserService } from './context-parser.service';

describe('ContextParserService', () => {
  const service = new ContextParserService();

  it('extracts nested leaves and preserves exact no-op bytes', () => {
    const raw = '{\n  "wallet": { "title": "Connect", "items": ["One"] },\n  "enabled": true\n}\n';
    const parsed = service.parse(raw, 'json');
    expect(parsed.strings.map((entry) => entry.keyPath)).toEqual([
      ['wallet', 'title'], ['wallet', 'items', 0],
    ]);
    expect(service.reconstructLosslessly(parsed, parsed.strings)).toBe(raw);
  });

  it('parses TS i18n exports without exposing require', () => {
    const parsed = service.parse('export default { title: "Swap" };', 'ts-i18n');
    expect(parsed.strings[0]).toEqual({ keyPath: ['title'], value: 'Swap' });
  });

  it('rejects malformed JSON', () => {
    expect(() => service.parse('{', 'json')).toThrow(BadRequestException);
  });

  it('never executes dynamic TS/JS expressions', () => {
    expect(() => service.parse('export default { title: (() => "bad")() };', 'ts-i18n')).toThrow(/Dynamic expression/);
  });

  it('preserves CommonJS module style when emitting changed content', () => {
    const parsed = service.parse('module.exports = { title: "Old" };', 'js-i18n');
    expect(service.serialize(parsed, { title: 'New' })).toBe('module.exports = {\n  "title": "New"\n};\n');
  });
});
