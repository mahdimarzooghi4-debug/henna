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

// SMS provider is deliberately UNCONFIGURED by default. A production sender
// must be implemented against an actual contracted provider and reviewed
// before replacing this registration. A signing key alone never enables OTP.
builder.Services.AddSingleton<IOtpSmsSender, UnconfiguredOtpSmsSender>();
var otpKeyConfigured = false;
try
{
    var base64 = builder.Configuration["Otp:DigestKeyBase64"];
    if (!string.IsNullOrWhiteSpace(base64))
    {
        var secret = Convert.FromBase64String(base64);
        if (secret.Length >= 32)
        {
            builder.Services.AddSingleton(new OtpCodeCryptography(secret));
            otpKeyConfigured = true;
        }
    }
}
catch (FormatException)
{
    // Invalid secret configuration fails closed. Never log secret material.
}


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

if (hasIdentityDb && otpKeyConfigured)
    builder.Services.AddScoped<OtpChallengeIssuer>();


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

// No real SMS adapter is connected: normal deployments still return 503.
// The request workflow is wired for future provider integration, never mock
// delivery, and cannot issue a challenge without both DB and secret.
app.MapPost("/api/v1/auth/otp/request", async (
        OtpRequest payload, IServiceProvider services,
        CancellationToken cancellationToken) =>
    {
        if (!IranianMobileNumber.TryParse(payload.Phone, out var phone))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["phone"] = ["شماره موبایل معتبر نیست."]
            });
        }

        static IResult Unavailable() => Results.Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "خدمت ارسال کد تأیید هنوز فعال نیست.",
            detail: "کدی ارسال نشده یا وضعیت ارسال نامشخص است؛ لطفاً بعداً تلاش کنید.");

        if (!hasIdentityDb || !otpKeyConfigured ||
            !services.GetRequiredService<IOtpSmsSender>().IsAvailable)
            return Unavailable();

        try
        {
            var issued = await services.GetRequiredService<OtpChallengeIssuer>()
                .IssueAsync(phone!, cancellationToken);
            return issued.Status switch
            {
                OtpIssueStatus.Accepted =>
                    Results.Accepted(value: new { challengeId = issued.ChallengeId }),
                OtpIssueStatus.Cooldown =>
                    Results.StatusCode(StatusCodes.Status429TooManyRequests),
                _ => Unavailable()
            };
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            // Do not report success on DB/provider errors or leak PII/secret.
            return Unavailable();
        }
    })
    .RequireRateLimiting("otp-request")
    .WithName("RequestOtp")
    .WithTags("Identity")
    .ProducesValidationProblem()
    .Produces(StatusCodes.Status202Accepted)
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
