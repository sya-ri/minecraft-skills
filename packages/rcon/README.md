# @minecraft-skills/rcon

RCON configuration, permission, and execution utilities for minecraft-skills.

## Install

```sh
pnpm add @minecraft-skills/rcon
```

Node.js 22.12 or newer is required.

## Examples

```ts
import {
  createRconConfig,
  evaluateRconPermission,
  getRconConfigStatus,
  runRconCommand,
} from "@minecraft-skills/rcon";

createRconConfig({
  configPath: "./.minecraft-skills/rcon.json",
  preset: "readonly",
});

const status = getRconConfigStatus({
  configPath: "./.minecraft-skills/rcon.json",
});

const decision = evaluateRconPermission("list");

const result = await runRconCommand({
  command: "list",
  configPath: "./.minecraft-skills/rcon.json",
});
```

`runRconCommand` sends the command only when the selected profile is configured and the regex
permissions allow it. Rejected commands return a permission decision without contacting the server.

## Configuration

Secrets should stay in environment variables. Config values can use `$env:NAME`:

```json
{
  "$schema": "https://raw.githubusercontent.com/sya-ri/minecraft-skills/main/schema/rcon-config.schema.json",
  "defaultProfile": "local",
  "profiles": {
    "local": {
      "host": "127.0.0.1",
      "port": 25575,
      "password": "$env:MINECRAFT_SKILLS_RCON_PASSWORD",
      "permissions": {
        "preset": "readonly"
      }
    }
  }
}
```

See the repository `docs/RCON.md` for config search order, permission presets, CLI usage, and MCP
behavior.
