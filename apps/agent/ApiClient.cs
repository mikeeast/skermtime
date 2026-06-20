using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace Skermtime.Agent;

public sealed class ApiClient(HttpClient http, IOptions<AgentOptions> options)
{
    private readonly AgentOptions _opts = options.Value;

    public record PairResult(string Token, string? ChildAlias, int BalanceMinutes);
    public record ScheduleWindow(int StartMin, int EndMin, int[] Days);
    public record HeartbeatResult(
        int BalanceMinutes,
        int[] WarnAtMinutes,
        int LockAtMinutes,
        bool LockNow,
        string? Reason,
        int? MinutesUntilWindow,
        ScheduleWindow[] ScheduleWindows,
        int ServerLocalDow,
        int ServerLocalMinute);
    public record TamperResult(int BonusMinutes, string? Message);

    private string Url(string path) => _opts.ServerUrl.TrimEnd('/') + path;

    private static readonly string Version =
        System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0";

    public async Task<PairResult?> PairAsync(string code, CancellationToken ct)
    {
        var res = await http.PostAsJsonAsync(
            Url("/api/agent/pair"),
            new
            {
                code,
                name = Environment.MachineName,
                os = Environment.OSVersion.VersionString,
                version = Version,
            },
            ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadFromJsonAsync<PairResponse>(ct);
        return body is null ? null : new PairResult(body.token, body.childAlias, body.balanceMinutes);
    }

    public async Task<HeartbeatResult?> HeartbeatAsync(string token, int consumedMinutes, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, Url("/api/agent/heartbeat"))
        {
            Content = JsonContent.Create(new { consumedMinutes, version = Version }),
        };
        req.Headers.Authorization = new("Bearer", token);
        var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadFromJsonAsync<HeartbeatResponse>(ct);
        if (body is null) return null;
        var windows = (body.scheduleWindows ?? [])
            .Select(w => new ScheduleWindow(w.startMin, w.endMin, w.days ?? []))
            .ToArray();
        return new HeartbeatResult(
            body.balanceMinutes,
            body.warnAtMinutes ?? [],
            body.lockAtMinutes,
            body.lockNow,
            body.reason,
            body.minutesUntilWindow,
            windows,
            body.serverLocalDow,
            body.serverLocalMinute);
    }

    public async Task<TamperResult?> ReportTamperAsync(string token, string type, string? writeup, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, Url("/api/agent/tamper"))
        {
            Content = JsonContent.Create(new { type, writeup }),
        };
        req.Headers.Authorization = new("Bearer", token);
        var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return null;
        var body = await res.Content.ReadFromJsonAsync<TamperResponse>(ct);
        return body is null ? null : new TamperResult(body.bonusMinutes, body.message);
    }

    private sealed record PairResponse(string token, string? childAlias, int balanceMinutes);
    private sealed record HeartbeatResponse(
        int balanceMinutes,
        int[]? warnAtMinutes,
        int lockAtMinutes,
        bool lockNow,
        string? reason,
        int? minutesUntilWindow,
        ScheduleWindowDto[]? scheduleWindows,
        int serverLocalDow,
        int serverLocalMinute);
    private sealed record ScheduleWindowDto(int startMin, int endMin, int[]? days);
    private sealed record TamperResponse(int bonusMinutes, string? message);
}
