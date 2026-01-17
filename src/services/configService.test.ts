import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CLIConfigService } from './cliConfigService';
import * as fs from 'fs';
import * as os from 'os';

// Mocking fs functions
vi.mock('fs', async () => {
  return {
    default: {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('os', async () => {
  return {
    default: {
        homedir: vi.fn(() => '/mock/home'),
    },
    homedir: vi.fn(() => '/mock/home'),
  };
});

describe('CLIConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prioritize environment variables', async () => {
    process.env.ZAI_API_KEY = 'env-key';
    const service = new CLIConfigService();
    
    // Mock fs.existsSync to return false so no file is read
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const key = await service.get('universalQuota.zai.apiKey');
    expect(key).toBe('env-key');
    
    delete process.env.ZAI_API_KEY;
  });

  it('should fallback to config file if env var is missing', async () => {
    // Ensure env var is cleared
    delete process.env.ZAI_API_KEY;
    const service = new CLIConfigService();

    const configContent = JSON.stringify({
      'universalQuota.zai.apiKey': 'file-key'
    });

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(configContent);

    const key = await service.get('universalQuota.zai.apiKey');
    expect(key).toBe('file-key');
  });

  it('should store value in config file', async () => {
    const service = new CLIConfigService();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    
    await service.store('universalQuota.zai.apiKey', 'new-key');

    expect(fs.writeFileSync).toHaveBeenCalled();
    const args = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(JSON.parse(args[1] as string)).toEqual({
      'universalQuota.zai.apiKey': 'new-key'
    });
  });
});
