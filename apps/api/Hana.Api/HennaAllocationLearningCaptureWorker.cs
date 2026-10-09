using Hana.Infrastructure.CreditLearning;

namespace Hana.Api;

/// <summary>
/// Periodically transfers first-party allocation observations from Henna's
/// commerce journal into the local learning database. It uses direct scoped
/// database services only; no network/model API is part of this path.
/// </summary>
internal sealed class HennaAllocationLearningCaptureWorker(
    IServiceScopeFactory scopes,
    ILogger<HennaAllocationLearningCaptureWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var capture = scope.ServiceProvider
                    .GetRequiredService<HennaAllocationLearningCapture>();
                var added = await capture.CapturePendingAsync(
                    cancellationToken: stoppingToken);
                if (added > 0)
                    logger.LogInformation(
                        "Captured {Count} first-party Henna allocation snapshots.",
                        added);

                var outcomeCapture = scope.ServiceProvider
                    .GetRequiredService<HennaAllocationOutcomeCapture>();
                var outcomes = await outcomeCapture.CaptureCreditUsageAsync(
                    cancellationToken: stoppingToken);
                if (outcomes > 0)
                    logger.LogInformation(
                        "Captured {Count} first-party Henna allocation credit outcomes.",
                        outcomes);
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception)
            {
                // Commerce remains authoritative. Learning capture retries and
                // must never turn a committed allocation into a false failure.
                logger.LogWarning(
                    "Henna allocation learning capture did not complete; " +
                    "the append-only commerce journal remains available for retry.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
