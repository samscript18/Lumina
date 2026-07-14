import { Controller, Get, NotFoundException, Query, UseGuards } from '@nestjs/common';
import { Web3GlossaryRepository } from '../database/repositories/web3-glossary.repository';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@UseGuards(ApiKeyGuard)
@Controller('glossary')
export class GlossaryController {
  constructor(private readonly glossaryRepo: Web3GlossaryRepository) {}

  @Get()
  async lookup(@Query('term') term?: string, @Query('domainContext') domainContext?: string) {
    if (term) {
      const entry = await this.glossaryRepo.findByTerm(term);
      if (!entry) {
        throw new NotFoundException(`No glossary entry found for term "${term}"`);
      }
      return this.serialize(entry);
    }

    const entries = await this.glossaryRepo.findAll(domainContext as never);
    return entries.map((e) => this.serialize(e));
  }

  private serialize(entry: { term: string; domainContext: string; localizedMappings: Map<string, string> }) {
    return {
      term: entry.term,
      domainContext: entry.domainContext,
      localizedMappings: Object.fromEntries(entry.localizedMappings ?? new Map()),
    };
  }
}
