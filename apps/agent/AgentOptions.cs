namespace Skermtime.Agent;

/// <summary>Bound from the "Skermtime" section of appsettings.json / env vars.</summary>
public sealed class AgentOptions
{
    public string ServerUrl { get; set; } = "http://localhost:3000";

    /// <summary>One-time 6-digit code from the parent's dashboard. Cleared after pairing.</summary>
    public string? PairingCode { get; set; }

    public int HeartbeatSeconds { get; set; } = 30;

    /// <summary>Input idle beyond this is not counted as screen time.</summary>
    public int IdleThresholdSeconds { get; set; } = 60;
}
