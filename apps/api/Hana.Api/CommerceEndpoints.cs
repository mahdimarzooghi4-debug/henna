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
 app.MapGet("/api/v1/offers",async(Guid? productId,int? page,HttpContext http,IServiceProvider services,CancellationToken ct)=>{
  http.Response.Headers.CacheControl="no-store";if(!configured)return Results.StatusCode(503);
  try{return Results.Ok(await services.GetRequiredService<CommerceService>().PublicOffers(productId,page??1,ct));}
  catch(ArgumentException){return Results.BadRequest();}catch(Exception)when(!ct.IsCancellationRequested){return Results.StatusCode(503);}
 });
 var group=app.MapGroup("/api/v1/commerce").WithTags("Commerce");
 Func<EndpointFilterInvocationContext,EndpointFilterDelegate,ValueTask<object?>> guard=async(context,next)=>{
 var http=context.HttpContext;http.Response.Headers.CacheControl="no-store";
 if(!http.Request.IsHttps&&!app.Environment.IsDevelopment())return Results.StatusCode(503);
 var header=http.Request.Headers.Authorization.ToString();if(!header.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)||!SessionTokenCodec.TryComputeDigest(header[7..],out _))return Results.Unauthorized();
 if(!configured)return Results.StatusCode(503);
 try {var actor=await http.RequestServices.GetRequiredService<AuthSessionService>().ResolveAccountAsync(header[7..],http.RequestAborted);if(actor==null)return Results.Unauthorized();http.Items["CommerceActor"]=actor.Value;return await next(context);}
 catch(CommerceForbidden){return Results.StatusCode(403);}catch(CommerceMissing){return Results.NotFound();}
 catch(CommerceConflict e){return e.Message=="COMMAND_RATE_LIMITED"?Results.Json(new{error=e.Message},statusCode:429):Results.Conflict(new{error=e.Message});}
 catch(Exception e) when(e is ArgumentException or InvalidOperationException or KeyNotFoundException or FormatException or OverflowException){return Results.BadRequest(new{error="INVALID_COMMERCE_INPUT"});}
 catch(DbUpdateConcurrencyException){return Results.Conflict(new{error="RESOURCE_CHANGED"});}
 catch(Exception) when(!http.RequestAborted.IsCancellationRequested){return Results.StatusCode(503);}
 };
 group.AddEndpointFilter(guard);
 group.MapPost("/commands/{action}",async(string action,JsonElement input,HttpContext http,IServiceProvider services,CancellationToken ct)=>{
 if(!Guid.TryParse(http.Request.Headers["Idempotency-Key"].ToString(),out var key)||key==Guid.Empty)return Results.BadRequest(new{error="IDEMPOTENCY_KEY_REQUIRED"});
 return Results.Ok(await services.GetRequiredService<CommerceService>().ExecuteAsync((Guid)http.Items["CommerceActor"]!,key,action,input,ct));
 }).WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(65536));
 group.MapGet("/resources/{kind}",async(string kind,Guid? id,int? page,HttpContext http,IServiceProvider services,CancellationToken ct)=>Results.Ok(await services.GetRequiredService<CommerceService>().ReadAsync((Guid)http.Items["CommerceActor"]!,kind,id,page??1,ct)));
 var rest=app.MapGroup("/api/v1").WithTags("InternalCommerce").WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(65536));rest.AddEndpointFilter(guard);
 async Task<IResult> SendCommand(HttpContext http,IServiceProvider services,string action,JsonElement input,CancellationToken ct) {
  if(!Guid.TryParse(http.Request.Headers["Idempotency-Key"].ToString(),out var key)||key==Guid.Empty)return Results.BadRequest(new{error="IDEMPOTENCY_KEY_REQUIRED"});
  return Results.Ok(await services.GetRequiredService<CommerceService>().ExecuteAsync((Guid)http.Items["CommerceActor"]!,key,action,input,ct));
 }
 foreach(var (path,action) in new (string,string)[]{
  ("/carts/current/items","SET_CART_ITEM"),("/quotes","CREATE_QUOTE"),("/orders","PLACE_ORDER"),
  ("/me/addresses","SAVE_ADDRESS"),("/seller/offers","SAVE_OFFER"),("/me/withdrawals","REQUEST_WITHDRAWAL"),
  ("/me/evidence","SAVE_EVIDENCE"),("/support/tickets","OPEN_TICKET")}) {
   var commandAction=action;
   rest.MapPost(path,(JsonElement input,HttpContext http,IServiceProvider services,CancellationToken ct)=>SendCommand(http,services,commandAction,input,ct));
 }
 foreach(var (path,action,keyName) in new (string,string,string)[]{
  ("/orders/{id:guid}/cancel","CANCEL_ORDER","orderId"),("/orders/{id:guid}/pickup-confirmation","CONFIRM_PICKUP","orderId"),
  ("/seller/orders/{id:guid}/state","SELLER_ORDER_STATE","orderId"),("/orders/{id:guid}/incidents","REPORT_INCIDENT","orderId"),
  ("/support/incidents/{id:guid}/decision","DECIDE_INCIDENT","incidentId"),("/seller/item-returns/{id:guid}/contact","RETURN_CONTACT","incidentId"),
  ("/seller/item-returns/{id:guid}/visit","RETURN_VISIT","incidentId"),("/item-returns/{id:guid}/confirm-collection","CONFIRM_RETURN","incidentId"),
  ("/support/item-returns/{id:guid}/unavailability-decision","VERIFY_UNAVAILABILITY","incidentId"),
  ("/me/withdrawals/{id:guid}/cancel","CANCEL_WITHDRAWAL","withdrawalId"),("/support/tickets/{id:guid}/reply","REPLY_TICKET","ticketId")}) {
   var commandAction=action;var resourceKey=keyName;
   rest.MapPost(path,(Guid id,JsonElement input,HttpContext http,IServiceProvider services,CancellationToken ct)=>{
    if(input.ValueKind!=JsonValueKind.Object)return Task.FromResult<IResult>(Results.BadRequest());
    if(input.TryGetProperty(resourceKey,out var supplied)&&(!supplied.TryGetGuid(out var given)||given!=id))return Task.FromResult<IResult>(Results.BadRequest());
    var node=System.Text.Json.Nodes.JsonNode.Parse(input.GetRawText())!;node[resourceKey]=id;
    return SendCommand(http,services,commandAction,JsonSerializer.SerializeToElement(node),ct);
   });
 }
 foreach(var (path,kind) in new (string,string)[]{("/carts/current","CART"),("/orders","ORDER"),("/seller/orders","ORDER"),("/seller/offers","OFFER"),
  ("/me/addresses","ADDRESS"),("/me/credits","CREDIT"),("/me/wallet","WALLET"),("/me/withdrawals","WITHDRAWAL"),
  ("/me/incidents","INCIDENT"),("/me/notifications","NOTIFICATION"),("/support/tickets","TICKET"),("/support/incidents","INCIDENT"),("/seller/settlements","SETTLEMENT")}) {
   var resourceKind=kind;
   var view=path.StartsWith("/me/",StringComparison.Ordinal)||path=="/carts/current"||path=="/orders"?"BUYER":path.StartsWith("/seller/",StringComparison.Ordinal)?"SELLER":path.StartsWith("/support/",StringComparison.Ordinal)?"SUPPORT":null;
   rest.MapGet(path,(int? page,HttpContext http,IServiceProvider services,CancellationToken ct)=>services.GetRequiredService<CommerceService>().ReadAsync((Guid)http.Items["CommerceActor"]!,resourceKind,null,page??1,ct,view));
 }
 rest.MapGet("/evidence/{id:guid}",async(Guid id,HttpContext http,IServiceProvider services,CancellationToken ct)=>{
  var e=await services.GetRequiredService<CommerceService>().EvidenceAsync((Guid)http.Items["CommerceActor"]!,id,ct);
  http.Response.Headers["X-Content-Type-Options"]="nosniff";http.Response.Headers["Content-Security-Policy"]="default-src 'none'; sandbox";
  return Results.File(Convert.FromBase64String(e.ContentBase64),e.ContentType,fileDownloadName:id+".image");
 });

 rest.MapGet("/orders/{id:guid}",async(Guid id,HttpContext http,IServiceProvider services,CancellationToken ct)=>{
  var result=await services.GetRequiredService<CommerceService>().ReadAsync((Guid)http.Items["CommerceActor"]!,"ORDER",id,1,ct);
  return Results.Ok(JsonSerializer.SerializeToElement(result).GetProperty("items")[0]);
 });
 rest.MapGet("/carts/current/comparison",(HttpContext http,IServiceProvider services,CancellationToken ct)=>services.GetRequiredService<CommerceService>().ComparisonAsync((Guid)http.Items["CommerceActor"]!,ct));

 }
}
