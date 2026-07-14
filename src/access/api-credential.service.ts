import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Model } from 'mongoose';
import { ApiCredential, ApiCredentialDocument } from './api-credential.schema';

export const API_SCOPES = ['translate', 'decode', 'quote', 'glossary', 'metrics', 'mcp', 'gitops', 'admin'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export interface AuthenticatedCredential {
  id: string; name: string; prefix: string; scopes: string[]; source: 'database';
}

@Injectable()
export class ApiCredentialService {
  constructor(@InjectModel(ApiCredential.name) private readonly model: Model<ApiCredentialDocument>) {}

  static hash(rawKey: string): string { return createHash('sha256').update(rawKey).digest('hex'); }

  async authenticate(rawKey: string): Promise<AuthenticatedCredential | null> {
    const credential = await this.model.findOne({ keyHash: ApiCredentialService.hash(rawKey), active: true }).select('+keyHash').lean().exec();
    if (!credential || (credential.expiresAt && credential.expiresAt.getTime() <= Date.now())) return null;
    await this.model.updateOne({ _id: credential._id }, { $set: { lastUsedAt: new Date() }, $inc: { usageCount: 1 } }).exec();
    return { id: String(credential._id), name: credential.name, prefix: credential.prefix, scopes: credential.scopes, source: 'database' };
  }

  async create(input: { name: string; scopes: string[]; expiresAt?: Date; rotatedFrom?: string }) {
    const rawKey = `lum_live_${randomBytes(32).toString('base64url')}`;
    const prefix = rawKey.slice(0, 17);
    const document = await this.model.create({
      keyHash: ApiCredentialService.hash(rawKey), prefix, name: input.name, scopes: input.scopes,
      expiresAt: input.expiresAt, rotatedFrom: input.rotatedFrom,
    });
    return { apiKey: rawKey, credential: this.serialize(document) };
  }

  async list() {
    const credentials = await this.model.find().sort({ createdAt: -1 }).lean().exec();
    return credentials.map((credential) => this.serialize(credential));
  }

  async revoke(id: string) {
    const credential = await this.model.findByIdAndUpdate(id, { $set: { active: false } }, { new: true }).exec();
    if (!credential) throw new NotFoundException('API credential not found');
    return this.serialize(credential);
  }

  async rotate(id: string, revokeOld: boolean) {
    const previous = await this.model.findById(id).exec();
    if (!previous) throw new NotFoundException('API credential not found');
    const created = await this.create({
      name: `${previous.name} (rotated)`, scopes: previous.scopes,
      expiresAt: previous.expiresAt, rotatedFrom: String(previous._id),
    });
    if (revokeOld) await this.revoke(id);
    return { ...created, previousRevoked: revokeOld };
  }

  private serialize(credential: ApiCredential | ApiCredentialDocument | Record<string, unknown>) {
    const value = credential as ApiCredential & { _id?: unknown; createdAt?: Date; updatedAt?: Date };
    return {
      id: String(value._id), prefix: value.prefix, name: value.name, scopes: value.scopes,
      active: value.active, expiresAt: value.expiresAt, lastUsedAt: value.lastUsedAt,
      usageCount: value.usageCount, rotatedFrom: value.rotatedFrom,
      createdAt: value.createdAt, updatedAt: value.updatedAt,
    };
  }
}
