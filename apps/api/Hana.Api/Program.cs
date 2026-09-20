using Hana.Application.Time;
using Hana.Infrastructure.Time;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Hana.Domain.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// This is process liveness, NOT proof that the database, payment provider,
// or independent logistics provider are ready.
builder.Services.AddHealthChecks();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<IClock, SystemClock>();

// Connection string is supplied via secrets/environment, never checked in.
// The API can still report process liveness without configured PostgreSQL,
// while database readiness will correctly fail closed.
var identityConnectionString = builder.Configuration.GetConnectionString("IdentityDb");
var hasIdentityDb = !string.IsNullOrWhiteSpace(identityConnectionString);
if (hasIdentityDb)
{
    builder.Services.AddDbContext<HanaIdentityDbContext>(
        options => options.UseNpgsql(identityConnectionString));
}

// One gate per observed client IP. Reverse proxies must be configured with
// explicit trusted ForwardedHeaders before their addresses can be honored.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("otp-request", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var app = builder.Build();
app.UseExceptionHandler();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthChecks("/health/live");

// Readiness is different from liveness: ensure the real identity DB is
// reachable AND all migrations are applied. No schema or credentials are
// exposed in the response, including on exceptions.
app.MapGet("/health/ready", async (IServiceProvider services,
    CancellationToken cancellationToken) =>
{
    if (!hasIdentityDb)
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

    try
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HanaIdentityDbContext>();
        if (!await db.Database.CanConnectAsync(cancellationToken))
            return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);

        var pending = await db.Database.GetPendingMigrationsAsync(cancellationToken);
        return pending.Any()
            ? Results.StatusCode(StatusCodes.Status503ServiceUnavailable)
            : Results.Ok(new { ready = true, modules = new[] { "identity" } });
    }
    catch
    {
        return Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
    }
}).ExcludeFromDescription();

app.MapGet("/api/v1/system/status", (IClock clock) =>
        Results.Ok(new SystemStatus("hana-api", "bootstrap", clock.UtcNow)))
    .WithName("GetSystemStatus")
    .WithTags("System");

// Fail closed: SMS provider, durable OTP challenge store, verification,
// resend limits, and real account/session creation are not integrated yet.
app.MapPost("/api/v1/auth/otp/request", (OtpRequest payload) =>
    {
        if (!IranianMobileNumber.TryParse(payload.Phone, out _))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["phone"] = ["شماره موبایل معتبر نیست."]
            });
        }

        return Results.Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "خدمت ارسال کد تأیید هنوز فعال نیست.",
            detail: "ارسال پیامک و احراز هویت در حال راه‌اندازی است؛ کدی ارسال نشده است.");
    })
    .RequireRateLimiting("otp-request")
    .WithName("RequestOtp")
    .WithTags("Identity")
    .ProducesValidationProblem()
    .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
    .Produces(StatusCodes.Status429TooManyRequests);

// Migration is an explicit one-off operator action, never a side effect of
// starting ordinary API replicas. Store the real password only in env/secrets.
if (args.Contains("--apply-migrations", StringComparer.Ordinal))
{
    if (!hasIdentityDb)
        throw new InvalidOperationException("IdentityDb connection string is required.");

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<HanaIdentityDbContext>();
    await db.Database.MigrateAsync();
    return;
}

app.Run();

internal sealed record OtpRequest(string? Phone);

internal sealed record SystemStatus(string Service, string Phase, DateTimeOffset TimeUtc);

public partial class Program { }
