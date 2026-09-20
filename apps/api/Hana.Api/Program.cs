using Hana.Application.Time;
using Hana.Infrastructure.Time;

var builder = WebApplication.CreateBuilder(args);

// This is process liveness, NOT proof that the database, payment provider,
// or independent logistics provider are ready.
builder.Services.AddHealthChecks();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<IClock, SystemClock>();

var app = builder.Build();
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health/live");

app.MapGet("/api/v1/system/status", (IClock clock) =>
        Results.Ok(new SystemStatus("hana-api", "bootstrap", clock.UtcNow)))
    .WithName("GetSystemStatus")
    .WithTags("System");

app.Run();

internal sealed record SystemStatus(string Service, string Phase, DateTimeOffset TimeUtc);

public partial class Program { }
