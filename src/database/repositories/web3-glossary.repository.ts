import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Web3Glossary, Web3GlossaryDocument, DomainContext } from '../schemas/web3-glossary.schema';

@Injectable()
export class Web3GlossaryRepository {
  constructor(
    @InjectModel(Web3Glossary.name)
    private readonly model: Model<Web3GlossaryDocument>,
  ) {}

  async findByTerm(term: string): Promise<Web3GlossaryDocument | null> {
    return this.model.findOne({ term: term.toLowerCase().trim() }).exec();
  }

  async findAll(domainContext?: DomainContext): Promise<Web3GlossaryDocument[]> {
    const filter = domainContext ? { domainContext } : {};
    return this.model.find(filter).exec();
  }

  /**
   * Returns the subset of the glossary whose terms literally appear in `text`.
   * Used to build a compact, relevant glossary context for the LLM prompt
   * instead of dumping the entire collection into every request.
   */
  async findRelevantTerms(text: string): Promise<Web3GlossaryDocument[]> {
    const lower = text.toLowerCase();
    const all = await this.model.find().limit(2000).exec();
    return all.filter((entry) => {
      const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(lower);
    });
  }

  async upsertTerm(entry: {
    term: string;
    domainContext: DomainContext;
    localizedMappings?: Record<string, string>;
  }): Promise<Web3GlossaryDocument> {
    return this.model
      .findOneAndUpdate(
        { term: entry.term.toLowerCase().trim() },
        {
          $set: {
            domainContext: entry.domainContext,
            ...(entry.localizedMappings ? { localizedMappings: entry.localizedMappings } : {}),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
