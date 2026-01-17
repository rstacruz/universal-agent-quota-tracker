import * as vscode from 'vscode';
import { IConfigService } from './configService';

export class VSCodeConfigService implements IConfigService {
  constructor(private secrets: vscode.SecretStorage) {}

  async get(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    await this.secrets.store(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.secrets.delete(key);
  }
}
