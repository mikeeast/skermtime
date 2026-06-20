namespace Skermtime.Overlay;

// Fully qualified to avoid the WinForms/WPF `Application` ambiguity (UseWindowsForms).
public partial class App : System.Windows.Application
{
    private OverlayWindow? _window;

    protected override void OnStartup(System.Windows.StartupEventArgs e)
    {
        base.OnStartup(e);
        // The overlay lives in the tray + on top; closing the pill must not quit it.
        ShutdownMode = System.Windows.ShutdownMode.OnExplicitShutdown;
        _window = new OverlayWindow();
        _window.Show();
    }
}
