import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact, 'data')
    private readonly contactRepository: Repository<Contact>,
  ) {}

  async findAllBySession(sessionId: string): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { sessionId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByChatId(sessionId: string, chatId: string): Promise<Contact | null> {
    return this.contactRepository.findOne({
      where: { sessionId, chatId },
    });
  }

  async upsertFromMessage(
    sessionId: string,
    chatId: string,
    pushName?: string,
  ): Promise<Contact> {
    const existing = await this.findByChatId(sessionId, chatId);

    if (existing) {
      let changed = false;
      if (pushName && pushName !== existing.pushName) {
        existing.pushName = pushName;
        if (!existing.name) {
          existing.name = pushName;
        }
        changed = true;
      }
      if (changed) {
        return this.contactRepository.save(existing);
      }
      return existing;
    }

    const isGroup = chatId.endsWith('@g.us');
    const phone = isGroup ? '' : chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');

    const contact = new Contact();
    contact.sessionId = sessionId;
    contact.chatId = chatId;
    contact.phone = phone;
    contact.name = pushName || '';
    contact.pushName = pushName || '';
    contact.isGroup = isGroup;
    contact.status = 'active';

    return this.contactRepository.save(contact);
  }

  async saveContact(
    sessionId: string,
    chatId: string,
    name: string,
    phone?: string,
  ): Promise<Contact> {
    const existing = await this.findByChatId(sessionId, chatId);
    if (existing) {
      existing.name = name;
      return this.contactRepository.save(existing);
    }

    const isGroup = chatId.endsWith('@g.us');
    const contactPhone = phone || (isGroup ? '' : chatId.replace('@c.us', '').replace('@s.whatsapp.net', ''));

    const contact = new Contact();
    contact.sessionId = sessionId;
    contact.chatId = chatId;
    contact.phone = contactPhone;
    contact.name = name;
    contact.pushName = '';
    contact.isGroup = isGroup;
    contact.status = 'active';

    return this.contactRepository.save(contact);
  }

  async updateName(sessionId: string, chatId: string, name: string): Promise<Contact | null> {
    const contact = await this.findByChatId(sessionId, chatId);
    if (!contact) return null;
    contact.name = name;
    return this.contactRepository.save(contact);
  }

  async getContactMap(sessionId: string): Promise<Record<string, Contact>> {
    const contacts = await this.findAllBySession(sessionId);
    const map: Record<string, Contact> = {};
    for (const c of contacts) {
      map[c.chatId] = c;
    }
    return map;
  }
}
