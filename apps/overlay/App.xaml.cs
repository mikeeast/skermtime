using Velopack;
using Velopack.Sources;

namespace Skermtime.Overlay;

// Fully qualified to avoid the WinForms/WPF `Application` ambiguity (UseWindowsForms).
public partial class App : System.Windows.Application
{
    private const string RepoUrl = "https://github.com/mikeeast/skermtime";
    private OverlayWindow? _window;

    public App()
    {
        // Must run first: handles Velopack install/update/uninstall hooks.
        VelopackApp.Build().Run();
    }

    protected override void OnStartup(System.Windows.StartupEventArgs e)
    {
        base.OnStartup(e);
        // The overlay lives in the tray + on top; closing the pill must not quit it.
        ShutdownMode = System.Windows.ShutdownMode.OnExplicitShutdown;
        _window = new OverlayWindow();
        _window.Show();
        _ = CheckForUpdatesAsync();
    }

    private static async Task CheckForUpdatesAsync()
    {
        try
        {
            var mgr = new UpdateManager(
                new GithubSource(RepoUrl, null, false),
                new UpdateOptions { ExplicitChannel = "overlay" });
            if (!mgr.IsInstalled) return; // dev / not packaged
            var info = await mgr.CheckForUpdatesAsync();
            if (info is null) return;
            await mgr.DownloadUpdatesAsync(info);
            mgr.ApplyUpdatesAndRestart(info);
        }
        catch
        {
            /* updates are best-effort */
        }
    }
}
