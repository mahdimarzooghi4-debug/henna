using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
namespace Hana.Infrastructure.Commerce;
/// <summary>Opt-in internal SLA/settlement runner. The configured account must retain ADMIN permission.</summary>
public sealed class CommerceAutomation(IServiceScopeFactory scopes,IClock clock,ILogger<CommerceAutomation> logger,Guid account) : BackgroundService
{
 protected override async Task ExecuteAsync(CancellationToken stoppingToken)
 {
  using var timer=new PeriodicTimer(TimeSpan.FromMinutes(1));
  do {
   try {
    using var scope=scopes.CreateScope();var service=scope.ServiceProvider.GetRequiredService<CommerceService>();
    var minute=clock.UtcNow.ToString("yyyyMMddHHmm",System.Globalization.CultureInfo.InvariantCulture);
    foreach(var action in new[]{"ASSESS_RETURN_SLA","ASSESS_WITHDRAWAL_SLA","BUILD_SETTLEMENTS"}) {
     var key=new Guid(SHA256.HashData(Encoding.UTF8.GetBytes("commerce-automation:"+action+":"+minute))[..16]);
     await service.ExecuteAsync(account,key,action,JsonSerializer.SerializeToElement(new{}),stoppingToken);
    }
   }catch(OperationCanceledException)when(stoppingToken.IsCancellationRequested){break;}
   catch(Exception){logger.LogWarning("Commerce automation did not complete; retained state will be retried in a later minute.");}
  }while(await timer.WaitForNextTickAsync(stoppingToken));
 }
}
