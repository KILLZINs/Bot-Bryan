// Stub de compatibilidade — configuração persistida na memória
export interface BotConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  version: string;
}

const _config: BotConfig = {
  maintenanceMode: false,
  maintenanceMessage: 'Bot em manutenção.',
  version: '2.1.0',
};

export async function getBotConfig(): Promise<BotConfig> {
  return { ..._config };
}

export async function updateBotConfig(data: Partial<BotConfig>): Promise<BotConfig> {
  Object.assign(_config, data);
  return { ..._config };
}
