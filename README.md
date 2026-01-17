# Universal Agent Quota

Monitor quota for AI CLI tools in CLI.

This is a fork of [tctinh/universal-agent-quota-tracker](https://github.com/tctinh/universal-agent-quota-tracker) that makes it work in CLI instead of VS Code.

## Supported Providers

| Provider | Auth Method | Credential Location |
|----------|-------------|---------------------|
| **Antigravity** | OAuth (Google) | `~/.config/opencode/antigravity-accounts.json` |
| **Claude Code** | OAuth | macOS Keychain or `~/.claude/.credentials.json` |
| **Codex CLI** | OAuth + API Key | `~/.codex/auth.json` or `OPENAI_API_KEY` |
| **Gemini CLI** | OAuth 2.0 | `~/.gemini/oauth_creds.json` |
| **Z.AI** | API Key | `$ZAI_API_KEY` environment variable |

## CLI Usage

This tool includes a standalone CLI to check quotas from your terminal without opening VS Code.

### Installation

```bash
# Link locally
npm link

# Or run directly from source
npm run cli
```

### Commands

```bash
# Show quotas in a table
uaq

# Output JSON (for scripts)
uaq --json

# Show help
uaq --help
```

### Configuration (CLI)

The CLI looks for API keys in two places (in order of priority):

1. **Environment Variables**:
   - `ZAI_API_KEY`: API key for Z.AI

2. **Config File**: `~/.config/universal-agent-quota/config.json`
   ```json
   {
     "universalQuota.zai.apiKey": "your-key-here"
   }
   ```

## Requirements

Each provider reads credentials from its respective CLI tool:

- **Antigravity**: `opencode auth login`
- **Claude Code**: Run `claude` to authenticate
- **Codex CLI**: `codex login`
- **Gemini CLI**: Run `gemini` to authenticate
- **Z.AI**: Set `ZAI_API_KEY` environment variable

## License

MIT
