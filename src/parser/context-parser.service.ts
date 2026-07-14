import { Injectable, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';
import { ExtractedString, ParseResult, SourceFormat } from './interfaces/parsed-string.interface';

@Injectable()
export class ContextParserService {
  /**
   * Entry point. Detects/accepts a format and returns the extracted translatable
   * strings plus a skeleton that reconstruct() can use to rebuild the original
   * structure once strings come back translated.
   */
  parse(rawContent: string, format: SourceFormat): ParseResult {
    const skeleton = format === 'json' ? this.parseJson(rawContent) : this.parseTsOrJsModule(rawContent);

    const strings: ExtractedString[] = [];
    this.walk(skeleton, [], strings);

    return { format, strings, skeleton, sourceContent: rawContent };
  }

  /**
   * Rebuilds the original object structure, substituting translated values at
   * their original key paths. The parent structural key tree is left untouched —
   * only leaf string values are replaced.
   */
  reconstruct(skeleton: unknown, translated: ExtractedString[]): unknown {
    const clone = JSON.parse(JSON.stringify(skeleton));
    for (const entry of translated) {
      this.setAtPath(clone, entry.keyPath, entry.value);
    }
    return clone;
  }

  /** Returns the original bytes when reconstruction makes no value changes. */
  reconstructLosslessly(parsed: ParseResult, translated: ExtractedString[]): string {
    const original = new Map(parsed.strings.map((entry) => [JSON.stringify(entry.keyPath), entry.value]));
    const unchanged = translated.every(
      (entry) => original.get(JSON.stringify(entry.keyPath)) === entry.value,
    );
    if (unchanged && translated.length === parsed.strings.length) return parsed.sourceContent;

    return this.serialize(parsed, this.reconstruct(parsed.skeleton, translated));
  }

  serialize(parsed: ParseResult, rebuilt: unknown): string {
    const json = JSON.stringify(rebuilt, null, 2);
    if (parsed.format === 'json') return `${json}\n`;
    if (/\bmodule\.exports\s*=/.test(parsed.sourceContent)) return `module.exports = ${json};\n`;
    const named = parsed.sourceContent.match(/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=/);
    if (named?.[1] && rebuilt && typeof rebuilt === 'object' && named[1] in rebuilt) {
      return `export const ${named[1]} = ${JSON.stringify((rebuilt as Record<string, unknown>)[named[1]], null, 2)};\n`;
    }
    return `export default ${json};\n`;
  }

  // ---- internals ----

  private parseJson(rawContent: string): unknown {
    try {
      return JSON.parse(rawContent);
    } catch (err) {
      throw new BadRequestException(`Invalid JSON payload: ${(err as Error).message}`);
    }
  }

  /**
   * Handles TS/JS i18n files of the form:
   *   export default { ... }
   *   module.exports = { ... }
   *   export const messages = { ... }
   * using the TypeScript AST only. Repository source is never executed.
   */
  private parseTsOrJsModule(rawContent: string): unknown {
    const source = ts.createSourceFile('localization.ts', rawContent, ts.ScriptTarget.ES2022, true);
    let expression: ts.Expression | undefined;
    const named: Record<string, unknown> = {};

    for (const statement of source.statements) {
      if (ts.isExportAssignment(statement)) expression = statement.expression;
      if (ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression)) {
        const assignment = statement.expression;
        if (assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken && assignment.left.getText(source) === 'module.exports') {
          expression = assignment.right;
        }
      }
      if (ts.isVariableStatement(statement) && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.initializer) {
            named[declaration.name.text] = this.literalFromAst(declaration.initializer, source);
          }
        }
      }
    }

    if (expression) return this.literalFromAst(expression, source);
    if (Object.keys(named).length > 0) return named;
    throw new BadRequestException('TS/JS i18n file must export a static object literal');
  }

  private literalFromAst(node: ts.Expression, source: ts.SourceFile): unknown {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map((item) => this.literalFromAst(item as ts.Expression, source));
    if (ts.isObjectLiteralExpression(node)) {
      const output: Record<string, unknown> = {};
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) throw new BadRequestException('Only static key/value properties are allowed in i18n objects');
        const name = property.name;
        const key = ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined;
        if (key === undefined || key === '__proto__' || key === 'constructor' || key === 'prototype') {
          throw new BadRequestException(`Unsafe or unsupported i18n key: ${name.getText(source)}`);
        }
        output[key] = this.literalFromAst(property.initializer, source);
      }
      return output;
    }
    throw new BadRequestException(`Dynamic expression is not allowed in i18n files: ${node.getText(source)}`);
  }

  private walk(node: unknown, path: (string | number)[], out: ExtractedString[]): void {
    if (typeof node === 'string') {
      out.push({ keyPath: [...path], value: node });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => this.walk(item, [...path, idx], out));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        this.walk(value, [...path, key], out);
      }
    }
    // numbers, booleans, null are left as-is (non-translatable)
  }

  private setAtPath(root: any, path: (string | number)[], value: string): void {
    if (path.length === 0) throw new BadRequestException('Root string payloads are not supported as localization files');
    let cursor = root;
    for (let i = 0; i < path.length - 1; i++) {
      cursor = cursor[path[i]!];
    }
    cursor[path[path.length - 1]!] = value;
  }
}
