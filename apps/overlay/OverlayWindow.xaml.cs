using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace Skermtime.Overlay;

public partial class OverlayWindow : Window
{
    private static readonly string Dir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Skermtime");
    private static readonly string StatePath = Path.Combine(Dir, "state.json");
    private static readonly string ReportPath = Path.Combine(Dir, "report.json");
    private static readonly string PosPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Skermtime", "overlay-pos.txt");

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly HashSet<string> _seenMessages = new();
    private System.Windows.Forms.NotifyIcon? _tray;
    private bool _positioned;

    public OverlayWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        LocationChanged += (_, _) => { if (_positioned) SavePosition(); };
        Closed += (_, _) => _tray?.Dispose();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        RestorePosition();
        _positioned = true;
        SetupTray();

        var state = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        state.Tick += (_, _) => PollState();
        state.Start();

        var report = new DispatcherTimer { Interval = TimeSpan.FromSeconds(10) };
        report.Tick += (_, _) => WriteReport();
        report.Start();

        PollState();
        WriteReport();
    }

    private void SetupTray()
    {
        _tray = new System.Windows.Forms.NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Application,
            Visible = true,
            Text = "Skermtime",
        };
        var menu = new System.Windows.Forms.ContextMenuStrip();
        menu.Items.Add("Skermtime").Enabled = false;
        _tray.ContextMenuStrip = menu;
    }

    private void PollState()
    {
        AgentState? s = null;
        try
        {
            if (File.Exists(StatePath))
                s = JsonSerializer.Deserialize<AgentState>(File.ReadAllText(StatePath), Json);
        }
        catch { /* keep last value */ }

        if (s is null)
        {
            TimeText.Text = "–";
            Pill.Background = Brush("#E6111827");
            return;
        }

        if (s.LockNow)
        {
            TimeText.Text = "Låst";
            Pill.Background = Brush("#E6B91C1C");
        }
        else
        {
            TimeText.Text = Format(s.BalanceMinutes);
            Pill.Background = s.BalanceMinutes <= 5
                ? Brush("#E6B91C1C")
                : s.BalanceMinutes <= 15
                    ? Brush("#E6B45309")
                    : Brush("#E6111827");
        }

        foreach (var m in s.Messages ?? Array.Empty<MessageDto>())
        {
            if (string.IsNullOrEmpty(m.Id) || !_seenMessages.Add(m.Id)) continue;
            ShowMessage(m.Body);
        }
    }

    private void ShowMessage(string body)
    {
        MessageText.Text = body;
        MessageBorder.Visibility = Visibility.Visible;
        var hide = new DispatcherTimer { Interval = TimeSpan.FromSeconds(10) };
        hide.Tick += (s, _) =>
        {
            MessageBorder.Visibility = Visibility.Collapsed;
            ((DispatcherTimer)s!).Stop();
        };
        hide.Start();
    }

    private void WriteReport()
    {
        try
        {
            var hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero) return;
            GetWindowThreadProcessId(hwnd, out var pid);

            string? app = null;
            try { app = Process.GetProcessById((int)pid).ProcessName; } catch { }

            var sb = new StringBuilder(512);
            GetWindowText(hwnd, sb, sb.Capacity);
            var title = sb.ToString();

            var report = new ForegroundReport(app, title, DateTimeOffset.UtcNow.ToString("o"));
            File.WriteAllText(ReportPath, JsonSerializer.Serialize(report, Json));
        }
        catch { /* directory not yet provisioned by the service, or no access */ }
    }

    private static string Format(int m) =>
        m >= 60 ? $"{m / 60}h {m % 60}m" : $"{m}m";

    private static SolidColorBrush Brush(string hex) =>
        new((System.Windows.Media.Color)System.Windows.Media.ColorConverter.ConvertFromString(hex));

    private void OnDrag(object sender, MouseButtonEventArgs e)
    {
        if (e.ButtonState == MouseButtonState.Pressed) DragMove();
    }

    private void RestorePosition()
    {
        try
        {
            if (File.Exists(PosPath))
            {
                var parts = File.ReadAllText(PosPath).Split(',');
                if (parts.Length == 2 &&
                    double.TryParse(parts[0], out var l) && double.TryParse(parts[1], out var t))
                {
                    Left = l;
                    Top = t;
                    return;
                }
            }
        }
        catch { }

        var wa = SystemParameters.WorkArea;
        Left = wa.Right - ActualWidth - 16;
        Top = wa.Bottom - ActualHeight - 16;
    }

    private void SavePosition()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(PosPath)!);
            File.WriteAllText(PosPath, $"{Left},{Top}");
        }
        catch { }
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}

internal record AgentState(
    int BalanceMinutes,
    bool LockNow,
    string? Reason,
    int? MinutesUntilWindow,
    MessageDto[]? Messages,
    string? UpdatedAt);

internal record MessageDto(string Id, string Body);

internal record ForegroundReport(string? App, string? Title, string? At);
