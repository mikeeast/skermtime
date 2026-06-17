# Skermtime Agent (Windows)

.NET 10 Worker that runs on a child's PC. It counts active screen time, reports
it to the Skermtime backend, warns as the balance runs low, and **locks the
workstation** when it hits zero. Tamper attempts are detected and **rewarded**
with bonus minutes (a bug bounty for your own kid), not punished.

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

On first run the agent exchanges the code for a device token, stored under
`%LOCALAPPDATA%\Skermtime\device-token.txt`. The code is then consumed; clear it
from config. Subsequent runs reuse the stored token.

## Install as a Windows Service (production)

Run as **LocalSystem** so a standard (non-admin) child account can't stop it:

```powershell
dotnet publish apps/agent -c Release -r win-x64 --self-contained -o C:\Skermtime
New-Service -Name "SkermtimeAgent" -BinaryPathName "C:\Skermtime\Skermtime.Agent.exe" -StartupType Automatic
sc.exe failure SkermtimeAgent reset= 0 actions= restart/5000   # auto-restart if killed
Start-Service SkermtimeAgent
```

## Hardening (before public launch)

- Encrypt the stored token with **DPAPI** (`ProtectedData`) instead of plaintext.
- **Code-sign** the published exe/installer to avoid SmartScreen warnings.
- Run the child account as **standard (non-admin)**; the service runs as LocalSystem.
- A tray app for the child-facing warnings (the service currently logs them).
