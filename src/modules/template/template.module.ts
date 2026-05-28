import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateService } from './template.service';
import { TemplateController } from './template.controller';
import { MessageTemplate } from './entities/message-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MessageTemplate], 'data')],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
