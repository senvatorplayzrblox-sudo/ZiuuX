import { StaffPanelConfigModel, type StaffPanelConfigDoc } from '../models/index.js';

export const StaffPanelConfigRepo = {
  get(guildId: string): Promise<StaffPanelConfigDoc | null> {
    return StaffPanelConfigModel.findOne({ guildId }).lean<StaffPanelConfigDoc>().exec();
  },
  async setRoles(guildId: string, staffRoleIds: string[]): Promise<void> {
    await StaffPanelConfigModel.updateOne({ guildId }, { $set: { staffRoleIds } }, { upsert: true, setDefaultsOnInsert: false });
  },
  async deleteGuildData(guildId: string): Promise<void> {
    await StaffPanelConfigModel.deleteMany({ guildId });
  },
};
