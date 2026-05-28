import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageTemplate } from './entities/message-template.entity';
import { createLogger } from '../../common/services/logger.service';

const logger = createLogger('TemplateService');

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(MessageTemplate, 'data')
    private readonly templateRepository: Repository<MessageTemplate>,
  ) {}

  /**
   * List all templates, optionally filtered by category.
   * Ordered by usageCount DESC (most-used first).
   */
  async findAll(category?: string): Promise<MessageTemplate[]> {
    const where: Record<string, unknown> = {};
    if (category) {
      where.category = category;
    }
    return this.templateRepository.find({
      where,
      order: { usageCount: 'DESC' },
    });
  }

  /**
   * Return distinct category values across all templates.
   */
  async findCategories(): Promise<string[]> {
    const rows = await this.templateRepository
      .createQueryBuilder('t')
      .select('DISTINCT t.category', 'category')
      .where('t.category IS NOT NULL')
      .orderBy('t.category', 'ASC')
      .getRawMany<{ category: string }>();

    return rows.map((r) => r.category);
  }

  /**
   * Get a single template by ID.
   */
  async findOne(id: string): Promise<MessageTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return template;
  }

  /**
   * Create a new template.
   */
  async create(data: {
    name: string;
    category?: string;
    body: string;
    language?: string;
  }): Promise<MessageTemplate> {
    const entity = this.templateRepository.create(data);
    const saved = await this.templateRepository.save(entity);
    logger.log(`Template created: ${saved.id} (${saved.name})`);
    return saved;
  }

  /**
   * Partially update an existing template.
   */
  async update(
    id: string,
    data: Partial<{ name: string; category: string; body: string; language: string; isActive: boolean }>,
  ): Promise<MessageTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, data);
    return this.templateRepository.save(template);
  }

  /**
   * Delete a template by ID.
   */
  async delete(id: string): Promise<void> {
    const template = await this.findOne(id);
    await this.templateRepository.remove(template);
    logger.log(`Template deleted: ${id}`);
  }

  /**
   * Increment the usage count for a template (called when used in scheduling).
   */
  async incrementUsage(id: string): Promise<MessageTemplate> {
    const template = await this.findOne(id);
    template.usageCount += 1;
    return this.templateRepository.save(template);
  }
}
