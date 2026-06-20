using Microsoft.Extensions.Logging;
using Velopack;
using Velopack.Sources;

namespace Skermtime.Agent;

// Self-update via Velopack against GitHub Releases. No-ops in dev (not installed via
// the Velopack Setup). When an update is found the service applies it and restarts;
// the SCM failure-action (restart/5000) brings the service back up.
public static class Updater
{
    private const string RepoUrl = "https://github.com/mikeeast/skermtime";

    public static async Task CheckAsync(ILogger logger, CancellationToken ct)
    {
        try
        {
            var mgr = new UpdateManager(
                new GithubSource(RepoUrl, null, false),
                new UpdateOptions { ExplicitChannel = "service" });
            if (!mgr.IsInstalled) return;

            var info = await mgr.CheckForUpdatesAsync().WaitAsync(ct);
            if (info is null) return;

            await mgr.DownloadUpdatesAsync(info).WaitAsync(ct);
            logger.LogInformation("Uppdatering {Version} hämtad — startar om.",
                info.TargetFullRelease.Version);
            mgr.ApplyUpdatesAndRestart(info);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Uppdateringskontroll misslyckades.");
        }
    }
}
