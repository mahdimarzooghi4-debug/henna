using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
namespace Hana.Infrastructure.Commerce;

public static class CommerceAutomationSchedule
{
 public const string TimezoneId="Asia/Tehran";
 public static DateOnly? SettlementBusinessDate(DateTimeOffset utcNow)
 {
  var iran=TimeZoneInfo.FindSystemTimeZoneById(TimezoneId);
  var local=TimeZoneInfo.ConvertTime(utcNow,iran);
  return local.Hour==0&&local.Minute==0
   ? DateOnly.FromDateTime(local.DateTime).AddDays(-1)
   : null;
 }
 public static Guid Key(string action,string scope)
 {
  var hash=SHA256.HashData(Encoding.UTF8.GetBytes(
   "commerce-automation:"+action+":"+scope));
  // RFC 4122-compatible deterministic v4-shaped UUID; entropy is derived from
  // the action/scope, not random, so concurrent replicas use the same key.
  hash[6]=(byte)((hash[6]&0x0f)|0x40);
  hash[8]=(byte)((hash[8]&0x3f)|0x80);
  return new Guid(hash[..16]);
 }
}

/// <summary>
/// Opt-in internal SLA/settlement runner. The configured account must retain
/// ADMIN permission. Bank submission remains outside this runner.
/// </summary>
public sealed class CommerceAutomation(
 IServiceScopeFactory scopes,IClock clock,ILogger<CommerceAutomation> logger,
 Guid account) : BackgroundService
{
 protected override async Task ExecuteAsync(CancellationToken stoppingToken)
 {
  using var timer=new PeriodicTimer(TimeSpan.FromMinutes(1));
  do {
   try {
    using var scope=scopes.CreateScope();
    var service=scope.ServiceProvider.GetRequiredService<CommerceService>();
    var now=clock.UtcNow;
    var minute=now.ToString(
     "yyyyMMddHHmm",System.Globalization.CultureInfo.InvariantCulture);
    foreach(var action in new[]{"ASSESS_RETURN_SLA","ASSESS_WITHDRAWAL_SLA"}) {
     await service.ExecuteAsync(
      account,CommerceAutomationSchedule.Key(action,minute),action,
      JsonSerializer.SerializeToElement(new{}),stoppingToken);
    }

    // ADR-042/043: settlement preparation starts only during the local
    // 00:00 minute in Asia/Tehran. A daily deterministic key deduplicates
    // concurrent API replicas. We deliberately do not "catch up" at noon from
    // current mutable state because that would fabricate the midnight cutoff.
    var businessDate=CommerceAutomationSchedule.SettlementBusinessDate(now);
    if(businessDate is { } date) {
     var key=CommerceAutomationSchedule.Key(
      "BUILD_SETTLEMENTS",date.ToString("yyyy-MM-dd",
       System.Globalization.CultureInfo.InvariantCulture));
     await service.ExecuteAsync(
      account,key,"BUILD_SETTLEMENTS",
      JsonSerializer.SerializeToElement(new{}),stoppingToken);
    }
   }catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){
    break;
   }catch(Exception){
    logger.LogWarning(
     "Commerce automation did not complete; SLA work will retry next minute. "+
     "Settlement preparation never fabricates a missed midnight cutoff.");
   }
  }while(await timer.WaitForNextTickAsync(stoppingToken));
 }
}
