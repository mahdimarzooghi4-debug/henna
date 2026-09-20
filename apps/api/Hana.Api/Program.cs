using Hana.Application.Time;
using Hana.Infrastructure.Time;
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

app.Run();

internal sealed record OtpRequest(string? Phone);

internal sealed record SystemStatus(string Service, string Phase, DateTimeOffset TimeUtc);

public partial class Program { }
