import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { MessageTemplate } from './entities/message-template.entity';

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  @ApiOperation({ summary: 'List all message templates' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiResponse({ status: 200, description: 'List of message templates' })
  async findAll(@Query('category') category?: string): Promise<MessageTemplate[]> {
    return this.templateService.findAll(category);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List distinct template categories' })
  @ApiResponse({ status: 200, description: 'List of category strings' })
  async findCategories(): Promise<string[]> {
    return this.templateService.findCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a message template by ID' })
  @ApiResponse({ status: 200, description: 'Template details' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(@Param('id') id: string): Promise<MessageTemplate> {
    return this.templateService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new message template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async create(
    @Body() body: { name: string; category?: string; body: string; language?: string },
  ): Promise<MessageTemplate> {
    return this.templateService.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a message template' })
  @ApiResponse({ status: 200, description: 'Template updated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async update(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; category: string; body: string; language: string; isActive: boolean }>,
  ): Promise<MessageTemplate> {
    return this.templateService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message template' })
  @ApiResponse({ status: 204, description: 'Template deleted' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.templateService.delete(id);
  }

  @Post(':id/use')
  @ApiOperation({ summary: 'Increment template usage count' })
  @ApiResponse({ status: 200, description: 'Usage count incremented' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async incrementUsage(@Param('id') id: string): Promise<MessageTemplate> {
    return this.templateService.incrementUsage(id);
  }
}
