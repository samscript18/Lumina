import { SetMetadata } from '@nestjs/common';
import { ApiScope } from './api-credential.service';

export const REQUIRED_SCOPES = 'lumina:required-scopes';
export const RequireScopes = (...scopes: ApiScope[]) => SetMetadata(REQUIRED_SCOPES, scopes);
