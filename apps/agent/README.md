# Skermtime Agent (Windows)

Two cooperating processes on a child's PC:

- **`Skermtime.Agent`** (this project) — a .NET 10 **LocalSystem service** (the
  un-killable enforcer). Counts active screen time, reports it, enforces bedtime/
  daily-cap locks, **locks the workstation** at zero, rewards tamper attempts with
  bonus minutes. It is the only process that talks to the backend.
- **`Skermtime.Overlay`** ([../overlay](../overlay)) — a WPF app in the child's
  session showing a small always-on-top **pill** with remaining time, popping
  parent messages, and reporting the foreground app.

They coordinate via JSON files in `C:\ProgramData\Skermtime\` (`state.json` from the
service, `report.json` from the overlay) — the service and the child's session can't
share `%LOCALAPPDATA%`, so ProgramData is the bridge.

## Configure

`appsettings.json` → `Skermtime` section (or environment variables
`Skermtime__ServerUrl`, `Skermtime__PairingCode`, …):

| Key | Default | Meaning |
|---|---|---|
| `ServerUrl` | `http://localhost:3000` | Backend base URL |
| `PairingCode` | – | One-time 6-digit code from the parent dashboard (child → Enheter) |
| `HeartbeatSeconds` | `30` | How often to report/poll |
| `IdleThresholdSeconds` | `60` | Idle beyond this isn't counted as screen time |

## Pair & run (dev)

1. In the web app: open a child → **Enheter** → **Skapa parningskod** → copy the code.
2. Put the code in `appsettings.json` (`Skermtime:PairingCode`) and run:

```powershell
dotnet run --project apps/agent
```

On first run the agent exchanges the code for a device token, **DPAPI-encrypted**
under `C:\ProgramData\Skermtime\device-token.dat` (an old plaintext token is
migrated automatically). The code is then consumed; clear it from config.

Run the overlay in your own session to see the pill (run the service as admin first
so it can create `C:\ProgramData\Skermtime\`):

```powershell
dotnet run --project apps/overlay
```

## Install as a Windows Service (production)

Run as **LocalSystem** so a standard (non-admin) child account can't stop it:

```powershell
dotnet publish apps/agent -c Release -r win-x64 --self-contained -o C:\Skermtime
New-Service -Name "SkermtimeAgent" -BinaryPathName "C:\Skermtime\Skermtime.Agent.exe" -StartupType Automatic
sc.exe failure SkermtimeAgent reset= 0 actions= restart/5000   # auto-restart if killed
Start-Service SkermtimeAgent
```

## Auto-update & release (Velopack)

Both apps self-update via [Velopack](https://velopack.io) against this repo's GitHub
Releases, on **separate channels** (`service` and `overlay`) so each can swap its own
files independently. `UpdateManager` no-ops in dev (only runs when installed via the
Velopack Setup). The service applies updates and restarts (SCM brings it back via the
`restart/5000` failure action).

Cut a release by pushing a tag — CI ([../../.github/workflows/release.yml](../../.github/workflows/release.yml))
publishes, packs with `vpk`, and uploads installers to GitHub Releases:

```powershell
git tag agent-v1.0.1 && git push origin agent-v1.0.1
```

### Code signing (Azure Trusted Signing)
Unsigned releases work but trigger a SmartScreen warning on first install. To remove
it, set up an **Azure Trusted Signing** account + identity and add the signing step to
the release workflow (it has a commented placeholder + the secrets it expects). Until
then releases are unsigned.

### Still to validate on a real machine
- The **elevated install** that registers the LocalSystem service (Velopack's default
  install is per-user; service registration needs admin — see the installer hook).
- The **service self-update + restart** path end-to-end.
- Run the child account as **standard (non-admin)** so it can't stop the service.
