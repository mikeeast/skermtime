using Skermtime.Agent;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<AgentOptions>(builder.Configuration.GetSection("Skermtime"));
builder.Services.AddHttpClient<ApiClient>();
builder.Services.AddWindowsService(options => options.ServiceName = "Skermtime Agent");
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
