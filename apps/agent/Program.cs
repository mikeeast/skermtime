using Skermtime.Agent;
using Velopack;

// Must run first: handles Velopack install/update/uninstall hooks (may exit early).
VelopackApp.Build().Run();

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Skermtime"));
builder.Services.AddHttpClient<ApiClient>();
builder.Services.AddWindowsService(options => options.ServiceName = "Skermtime Agent");
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
