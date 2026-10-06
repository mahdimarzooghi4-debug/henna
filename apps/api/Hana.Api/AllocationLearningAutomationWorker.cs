using Hana.Infrastructure.CreditLearning;

namespace Hana.Api;

/// <summary>
/// Periodically checks explicit automation policy and reviewed first-party
/// cohorts. It may create offline training runs and pending proposals only.
/// It has no production activation or coefficient-promotion capability.
/// </summary>
internal sealed class AllocationLearningAutomationWorker(
    IServiceScopeFactory scopes,
    AllocationLearningAutomationPolicy policy,
    ILogger<AllocationLearningAutomationWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!policy.IsWorkerConfigured)
        {
            logger.LogInformation(
                "Allocation learning automation is disabled because its explicit policy/cadence is incomplete.");
            return;
        }

        using var timer = new PeriodicTimer(
            TimeSpan.FromMinutes(policy.PollIntervalMinutes!.Value));

        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var executor = scope.ServiceProvider
                    .GetRequiredService<AllocationLearningAutomationExecutor>();
                var result = await executor.ExecuteReadyAsync(stoppingToken);

                if (result.Runs.Count > 0)
                    logger.LogInformation(
                        "Allocation learning automation processed {Count} deterministic training run(s); status {Status}.",
                        result.Runs.Count,
                        result.Status);
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                // Fail closed: a worker error must never activate coefficients,
                // alter wallets, or fabricate a successful training result.
                logger.LogWarning(
                    exception,
                    "Allocation learning automation cycle failed; no production activation occurred.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
