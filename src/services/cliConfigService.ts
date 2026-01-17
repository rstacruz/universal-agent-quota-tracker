import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IConfigService } from './configService';

export class CLIConfigService implements IConfigService {
  private configPath: string;
  private configCache: Record<string, any> | null = null;
  
  // Mapping from internal keys to environment variables
  private envMap: Record<string, string> = {
    'universalQuota.zai.apiKey': 'ZAI_API_KEY',
    // Add other mappings here as needed
  };

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.config', 'universal-agent-quota', 'config.json');
  }

  async get(key: string): Promise<string | undefined> {
    // 1. Check environment variable
    const envVar = this.envMap[key];
    if (envVar && process.env[envVar]) {
      return process.env[envVar];
    }

    // 2. Check config file
    const config = this.readConfig();
    return config[key];
  }

  async store(key: string, value: string): Promise<void> {
    const config = this.readConfig();
    config[key] = value;
    this.writeConfig(config);
  }

  async delete(key: string): Promise<void> {
    const config = this.readConfig();
    if (key in config) {
      delete config[key];
      this.writeConfig(config);
    }
  }

  private readConfig(): Record<string, any> {
    if (this.configCache) {
      return this.configCache;
    }

    if (!fs.existsSync(this.configPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf8');
      this.configCache = JSON.parse(content);
      return this.configCache || {};
    } catch (error) {
      console.error(`Failed to read config file at ${this.configPath}:`, error);
      return {};
    }
  }

  private writeConfig(config: Record<string, any>): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      this.configCache = config;
    } catch (error) {
      console.error(`Failed to write config file at ${this.configPath}:`, error);
      throw error;
    }
  }
}
