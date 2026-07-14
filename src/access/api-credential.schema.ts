import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApiCredentialDocument = HydratedDocument<ApiCredential>;

@Schema({ timestamps: true, collection: 'api_credentials' })
export class ApiCredential {
  @Prop({ required: true, unique: true, index: true, select: false }) keyHash!: string;
  @Prop({ required: true, index: true }) prefix!: string;
  @Prop({ required: true, trim: true, maxlength: 120 }) name!: string;
  @Prop({ type: [String], required: true, default: [] }) scopes!: string[];
  @Prop({ default: true, index: true }) active!: boolean;
  @Prop({ type: Date, index: true }) expiresAt?: Date;
  @Prop({ type: Date }) lastUsedAt?: Date;
  @Prop({ default: 0, min: 0 }) usageCount!: number;
  @Prop() rotatedFrom?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const ApiCredentialSchema = SchemaFactory.createForClass(ApiCredential);
ApiCredentialSchema.index({ active: 1, expiresAt: 1 });
