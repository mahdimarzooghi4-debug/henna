using System.Text.Json;
using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
namespace Hana.Api;
internal static class CommerceEndpoints
{
 internal static void MapCommerce(this WebApplication app,bool configured) {
 app.MapGet("/api/v1/content/{slug}",async(string slug,HttpContext http,IServiceProvider services,CancellationToken ct)=>{
  http.Response.Headers.CacheControl="no-store";if(!configured)return Results.StatusCode(503);
  try {var content=await services.GetRequiredService<CommerceService>().PublicContent(slug,ct);return content==null?Results.NotFound():Results.Ok(content);}catch(Exception)when(!ct.IsCancellationRequested){return Results.StatusCode(503);}
 });
 var group=app.MapGroup("/api/v1/commerce").WithTags("Commerce");
 group.AddEndpointFilter(async(context,next)=>{
 var http=context.HttpContext;http.Response.Headers.CacheControl="no-store";
 if(!http.Request.IsHttps&&!app.Environment.IsDevelopment())return Results.StatusCode(503);
 var header=http.Request.Headers.Authorization.ToString();if(!header.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)||!SessionTokenCodec.TryComputeDigest(header[7..],out _))return Results.Unauthorized();
 if(!configured)return Results.StatusCode(503);
 try {var actor=await http.RequestServices.GetRequiredService<AuthSessionService>().ResolveAccountAsync(header[7..],http.RequestAborted);if(actor==null)return Results.Unauthorized();http.Items["CommerceActor"]=actor.Value;return await next(context);}
 catch(CommerceForbidden){return Results.StatusCode(403);}catch(CommerceMissing){return Results.NotFound();}
 catch(CommerceConflict e){return Results.Conflict(new{error=e.Message});}
 catch(Exception e) when(e is ArgumentException or InvalidOperationException or KeyNotFoundException or FormatException or OverflowException){return Results.BadRequest(new{error="INVALID_COMMERCE_INPUT"});}
 catch(DbUpdateConcurrencyException){return Results.Conflict(new{error="RESOURCE_CHANGED"});}
 catch(Exception) when(!http.RequestAborted.IsCancellationRequested){return Results.StatusCode(503);}
 });
 group.MapPost("/commands/{action}",async(string action,JsonElement input,HttpContext http,CommerceService service,CancellationToken ct)=>{
 if(!Guid.TryParse(http.Request.Headers["Idempotency-Key"].ToString(),out var key)||key==Guid.Empty)return Results.BadRequest(new{error="IDEMPOTENCY_KEY_REQUIRED"});
 return Results.Ok(await service.ExecuteAsync((Guid)http.Items["CommerceActor"]!,key,action,input,ct));
 }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(65536));
 group.MapGet("/resources/{kind}",async(string kind,Guid? id,int? page,HttpContext http,CommerceService service,CancellationToken ct)=>Results.Ok(await service.ReadAsync((Guid)http.Items["CommerceActor"]!,kind,id,page??1,ct)));
 }
}
