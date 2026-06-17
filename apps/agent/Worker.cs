using Microsoft.Extensions.Options;

namespace Skermtime.Agent;

public sealed class Worker(
    ILogger<Worker> logger,
    ApiClient api,
    IOptions<AgentOptions> options) : BackgroundService
{
    private readonly AgentOptions _opts = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var token = await EnsurePairedAsync(stoppingToken);
        if (token is null)
        {
            logger.LogError(
                "No device token and no valid pairing code. Set Skermtime:PairingCode and restart.");
            return;
        }

        var interval = TimeSpan.FromSeconds(Math.Max(10, _opts.HeartbeatSeconds));
        long idleThresholdMs = Math.Max(10, _opts.IdleThresholdSeconds) * 1000L;

        double activeSeconds = 0;
        int lastWarn = int.MaxValue;

        var sw = System.Diagnostics.Stopwatch.StartNew();
        var lastMono = sw.Elapsed;
        var lastWall = DateTimeOffset.UtcNow;

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await Task.Delay(interval, stoppingToken); }
            catch (OperationCanceledException) { break; }

            var nowMono = sw.Elapsed;
            var nowWall = DateTimeOffset.UtcNow;
            double monoDelta = (nowMono - lastMono).TotalSeconds;
            double wallDelta = (nowWall - lastWall).TotalSeconds;
            lastMono = nowMono;
            lastWall = nowWall;

            // Clock tamper: the wall clock and the monotonic clock should move together.
            if (Math.Abs(wallDelta - monoDelta) > 30)
            {
                logger.LogWarning("Clock tamper suspected (wall {Wall:F0}s vs mono {Mono:F0}s).",
                    wallDelta, monoDelta);
                var t = await api.ReportTamperAsync(token, "clock-change", null, stoppingToken);
                if (t is { BonusMinutes: > 0 })
                    logger.LogInformation("Bounty: {Message} (+{Min} min)", t.Message, t.BonusMinutes);
            }

            bool active = !OperatingSystem.IsWindows() || Native.IdleMilliseconds() < idleThresholdMs;
            if (active) activeSeconds += monoDelta;

            int consumed = (int)(activeSeconds / 60);
            var hb = await api.HeartbeatAsync(token, consumed, stoppingToken);
            if (hb is null)
            {
                logger.LogDebug("Heartbeat failed; will retry next tick.");
                continue;
            }
            if (consumed > 0) activeSeconds -= consumed * 60;

            int unsent = (int)(activeSeconds / 60);
            int effective = hb.BalanceMinutes - unsent;
            int maxWarn = hb.WarnAtMinutes.Length > 0 ? hb.WarnAtMinutes.Max() : 0;

            if (effective > maxWarn)
            {
                lastWarn = int.MaxValue; // reset warnings once comfortably above the thresholds
            }
            else
            {
                foreach (var w in hb.WarnAtMinutes.OrderByDescending(x => x))
                {
                    if (effective <= w && w < lastWarn)
                    {
                        logger.LogWarning("Skärmtid snart slut: ~{Min} min kvar.", Math.Max(0, effective));
                        lastWarn = w;
                        break;
                    }
                }
            }

            if (effective <= hb.LockAtMinutes)
            {
                logger.LogInformation("Saldo slut — låser skärmen.");
                if (OperatingSystem.IsWindows()) Native.Lock();
            }
        }
    }

    private async Task<string?> EnsurePairedAsync(CancellationToken ct)
    {
        var existing = TokenStore.Read();
        if (!string.IsNullOrWhiteSpace(existing)) return existing;

        var code = _opts.PairingCode?.Trim();
        if (string.IsNullOrWhiteSpace(code)) return null;

        logger.LogInformation("Pairing with code {Code}…", code);
        var result = await api.PairAsync(code, ct);
        if (result is null)
        {
            logger.LogError("Pairing failed (invalid or expired code?).");
            return null;
        }
        TokenStore.Save(result.Token);
        logger.LogInformation("Paired to {Alias}. Balance {Balance} min.",
            result.ChildAlias, result.BalanceMinutes);
        return result.Token;
    }
}
