import { OwnerAuditRepo } from '../database/repositories/index.js';
import type { OwnerAuditDoc } from '../database/models/index.js';

export class AuditService {
  recordSettingsChange(userId: string, detail: string, before: unknown, after: unknown): Promise<void> {
    return OwnerAuditRepo.create({ userId, guildId: null, kind: 'settings_change', detail, before, after });
  }
  recordPanelBypass(userId: string, guildId: string, panel: string): Promise<void> {
    return OwnerAuditRepo.create({ userId, guildId, kind: 'panel_bypass', detail: `config panel "${panel}" opened via owner bypass`, before: null, after: null });
  }
  recent(kind: OwnerAuditDoc['kind'], limit = 10): Promise<OwnerAuditDoc[]> {
    return OwnerAuditRepo.listRecent(kind, limit);
  }
}
