# RCON

minecraft-skills can run Minecraft RCON commands for local or configured servers. RCON is disabled
until a profile is configured. Secrets should stay in environment variables, not in the repository.

## Quick Start

Create a local config:

```sh
minecraft-skills rcon init --config ./.minecraft-skills/rcon.json --preset readonly
export MINECRAFT_SKILLS_RCON_PASSWORD='your-rcon-password'
minecraft-skills rcon status --config ./.minecraft-skills/rcon.json
minecraft-skills rcon run list --config ./.minecraft-skills/rcon.json
```

If the target config already exists, `rcon init` returns a warning and does not overwrite it. Pass
`--force` only when you intentionally want to replace the file.

## Config Locations

Config resolution order:

1. CLI `--config <path>` or MCP input `configPath`
2. `MINECRAFT_SKILLS_RCON_CONFIG`
3. `./.minecraft-skills/rcon.json`
4. `./minecraft-skills.rcon.json`
5. User config:
   - macOS: `~/Library/Application Support/minecraft-skills/rcon.json`
   - Linux: `${XDG_CONFIG_HOME:-~/.config}/minecraft-skills/rcon.json`
   - Windows: `%APPDATA%/minecraft-skills/rcon.json`
6. Env-only profile from `MINECRAFT_SKILLS_RCON_HOST` and
   `MINECRAFT_SKILLS_RCON_PASSWORD`

Repository-local config paths are ignored by git by default. Commit an example file instead if a
project needs shared connection conventions.

## Config File

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

`host`, `port`, `password`, and `timeoutMs` can use literal values or `$env:NAME`. `password` should
normally use `$env:NAME`.

Useful environment variables:

```sh
export MINECRAFT_SKILLS_RCON_CONFIG=./.minecraft-skills/rcon.json
export MINECRAFT_SKILLS_RCON_PROFILE=local
export MINECRAFT_SKILLS_RCON_HOST=127.0.0.1
export MINECRAFT_SKILLS_RCON_PORT=25575
export MINECRAFT_SKILLS_RCON_PASSWORD='your-rcon-password'
export MINECRAFT_SKILLS_RCON_PRESET=readonly
export MINECRAFT_SKILLS_RCON_TIMEOUT_MS=2000
```

## Permissions

Permissions use JavaScript regular expression strings with the `i` flag. Before matching,
commands are normalized by trimming, removing a leading `/`, and collapsing repeated whitespace.
`deny` is checked before `allow`. If neither matches, `defaultMode` decides.

If `permissions` is omitted, `readonly` is used. If `preset` is omitted inside `permissions`, the
rules are custom and `defaultMode` defaults to `deny`.

```json
{
  "permissions": {
    "preset": "readonly",
    "allow": ["^seed$"],
    "deny": ["^data get entity @a.*$"]
  }
}
```

Preset summary:

- `readonly`: `defaultMode: "deny"` with common inspection, list, get, and query commands allowed.
- `guarded`: `defaultMode: "allow"` with stop/restart/save, op/deop, ban/pardon/kick, and whitelist
  commands denied even when nested behind `execute`.
- `full`: `defaultMode: "allow"` with no built-in deny rules.

## MCP

MCP always exposes:

- `get_rcon_config_status`
- `create_rcon_config`

MCP exposes `run_rcon_command` only when RCON configuration resolves successfully. A rejected
command returns a permission decision and is not sent to the server.
