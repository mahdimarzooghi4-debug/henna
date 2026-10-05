using System.Security.Cryptography;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Commerce;
using Hana.Infrastructure.Geography;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;
using Npgsql;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
namespace Hana.Infrastructure.Tests;
public sealed class CommerceTests
{
 [Fact] public void SnapshotMatchesModel() {
  using var db=Context("Host=localhost;Database=check");var snapshot=db.GetService<IMigrationsAssembly>().ModelSnapshot!;
  var prior=db.GetService<IModelRuntimeInitializer>().Initialize(snapshot.Model,true);
  Assert.Empty(db.GetService<IMigrationsModelDiffer>().GetDifferences(prior.GetRelationalModel(),db.GetService<IDesignTimeModel>().Model.GetRelationalModel()));
 }
 [Fact] public void SettlementAutomationUsesTehranMidnightAndDailyStableKey() {
  var zone=TimeZoneInfo.FindSystemTimeZoneById("Asia/Tehran");
  DateTimeOffset AtLocal(int hour,int minute,int second) {
   var local=new DateTime(2026,10,6,hour,minute,second,DateTimeKind.Unspecified);
   return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local,zone));
  }
  Assert.Equal(new DateOnly(2026,10,5),
   CommerceAutomationSchedule.SettlementBusinessDate(AtLocal(0,0,27)));
  Assert.Null(CommerceAutomationSchedule.SettlementBusinessDate(AtLocal(0,1,0)));
  Assert.Null(CommerceAutomationSchedule.SettlementBusinessDate(AtLocal(12,0,0)));
  var a=CommerceAutomationSchedule.Key("BUILD_SETTLEMENTS","2026-10-05");
  Assert.Equal(a,CommerceAutomationSchedule.Key("BUILD_SETTLEMENTS","2026-10-05"));
  Assert.NotEqual(a,CommerceAutomationSchedule.Key("BUILD_SETTLEMENTS","2026-10-06"));
 }
 [Fact] public async Task CreditPurchaseCancellationAndDamageAreAtomicAuditedAndIdempotent() {
 var connection=Environment.GetEnvironmentVariable("ConnectionStrings__IdentityDb");if(string.IsNullOrWhiteSpace(connection))return;
 var database="commerce_test_"+Guid.NewGuid().ToString("N");
 await using(var adminConnection=new NpgsqlConnection(connection)) {await adminConnection.OpenAsync();await using var command=new NpgsqlCommand("CREATE DATABASE "+database,adminConnection);await command.ExecuteNonQueryAsync();}
 var isolated=new NpgsqlConnectionStringBuilder(connection){Database=database};connection=isolated.ConnectionString;
 await using var db=Context(connection);await db.Database.MigrateAsync();
 await using var identity=new HanaIdentityDbContext(new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(connection).Options);
 await using var catalog=new HanaCatalogDbContext(new DbContextOptionsBuilder<HanaCatalogDbContext>().UseNpgsql(connection).Options);
 await using var sellers=new HanaSellerDbContext(new DbContextOptionsBuilder<HanaSellerDbContext>().UseNpgsql(connection).Options);
 await using var geo=new HanaGeographyDbContext(new DbContextOptionsBuilder<HanaGeographyDbContext>().UseNpgsql(connection).Options);
 await identity.Database.MigrateAsync();await sellers.Database.MigrateAsync();await catalog.Database.MigrateAsync();await geo.Database.MigrateAsync();
 var province=Guid.NewGuid();var city=Guid.NewGuid();
 var clock=new Clock{UtcNow=DateTimeOffset.UtcNow};var admin=Guid.NewGuid();var seller=Guid.NewGuid();var buyer=Guid.NewGuid();var stranger=Guid.NewGuid();
 foreach(var account in new[]{admin,seller,buyer,stranger})identity.Accounts.Add(new(){Id=account,NormalizedPhone="09"+RandomNumberGenerator.GetInt32(1000000000).ToString("D9"),CreatedAtUtc=clock.UtcNow});
 identity.RoleAssignments.Add(new(){AccountId=admin,Role=HanaRoles.Admin,GrantedAtUtc=clock.UtcNow});identity.RoleAssignments.Add(new(){AccountId=seller,Role=HanaRoles.Seller,GrantedAtUtc=clock.UtcNow});await identity.SaveChangesAsync();
 // Isolated approved seller receipt: no application bypass in production.
 sellers.RegistrationDrafts.Add(new(){AccountId=seller,StoreName="CI",OwnerName="CI",Phone=identity.Accounts.Local.Single(a=>a.Id==seller).NormalizedPhone,City="CI",Address="CI",PostalCode="1234567890",UpdatedAtUtc=clock.UtcNow});await sellers.SaveChangesAsync();
 sellers.SellerActivations.Add(new(){Id=Guid.NewGuid(),ApplicationAccountId=seller,ActivatedByAccountId=admin,ActivationKey=Guid.NewGuid(),ExpectedRevision=1,CreatedAtUtc=clock.UtcNow});await sellers.SaveChangesAsync();
 var category=Guid.NewGuid();var product=Guid.NewGuid();var serviceProduct=Guid.NewGuid();
 catalog.Categories.Add(new(){Id=category,Name="CI food",Slug="ci-"+category,State=PublicationStates.Published,CreatedAtUtc=clock.UtcNow});
 catalog.Products.Add(new(){Id=product,CategoryId=category,Name="CI product",Kind=CatalogProductKinds.Good,State=PublicationStates.Published,CreatedAtUtc=clock.UtcNow});
 catalog.Products.Add(new(){Id=serviceProduct,CategoryId=category,Name="CI service",Kind=CatalogProductKinds.Service,State=PublicationStates.Published,CreatedAtUtc=clock.UtcNow});
 await catalog.SaveChangesAsync();
 geo.Provinces.Add(new(){Id=province,Name="CI",Slug="ci-"+province,State=GeographyStates.Selectable});geo.Cities.Add(new(){Id=city,ProvinceId=province,Name="CI",Slug="ci-"+city,State=GeographyStates.Selectable});await geo.SaveChangesAsync();
 var draft=await sellers.RegistrationDrafts.SingleAsync(d=>d.AccountId==seller);
 draft.CompletedStep=5;draft.ApplicantType="NATURAL";draft.NaturalNationalCode="0013549829";draft.IdentityStatus="VERIFIED";
 draft.BusinessCategoryId=Guid.NewGuid();sellers.BusinessCategories.Add(new(){Id=draft.BusinessCategoryId.Value,Name="CI",IsActive=true,UpdatedAtUtc=clock.UtcNow});
 draft.BusinessName="CI";draft.BusinessDescription="CI";draft.BusinessPhone="02112345678";draft.ServiceArea="CI city";draft.OfferingType="BOTH";draft.ActivityProvinceId=province;draft.ActivityCityId=city;draft.ActivityAddress="CI";draft.ActivityHours="CI";draft.Pickup=true;draft.SellerDelivery=false;
 await sellers.SaveChangesAsync();
 var roles=new RoleAuthorizationService(identity,new AuthSessionService(identity,clock));var service=new CommerceService(db,catalog,sellers,geo,identity,roles,clock);
 Task<JsonElement> Command(Guid actor,string action,object input,Guid? key=null)=>service.ExecuteAsync(actor,key??Guid.NewGuid(),action,JsonSerializer.SerializeToElement(input));
 var offerId=Guid.NewGuid();await Command(seller,"SAVE_OFFER",new{offerId,productId=product,priceRial=1000,stock=5,expectedVersion=0});
 await Assert.ThrowsAsync<CommerceForbidden>(()=>Command(buyer,"SAVE_OFFER",new{}));
 var serviceListingId=Guid.NewGuid();
 var serviceListing=await Command(seller,"SAVE_SERVICE_LISTING",new{
  listingId=serviceListingId,productId=serviceProduct,priceRial=2500,
  availabilityNote="CI weekdays by coordination",expectedVersion=0});
 Assert.Equal(1,serviceListing.GetProperty("Version").GetInt32());
 var serviceReplayKey=Guid.NewGuid();var serviceUpdate=new{
  listingId=serviceListingId,productId=serviceProduct,priceRial=2600,
  availabilityNote="CI weekdays 9-17",expectedVersion=1};
 var updatedService=await Command(seller,"SAVE_SERVICE_LISTING",serviceUpdate,serviceReplayKey);
 Assert.Equal(2,updatedService.GetProperty("Version").GetInt32());
 Assert.Equal(2,(await Command(seller,"SAVE_SERVICE_LISTING",serviceUpdate,serviceReplayKey)).GetProperty("Version").GetInt32());
 await Assert.ThrowsAsync<CommerceForbidden>(()=>Command(buyer,"SAVE_SERVICE_LISTING",new{}));
 var addressId=Guid.NewGuid();await Command(buyer,"SAVE_ADDRESS",new{addressId,cityId=city,text="CI only",latitude=35m,longitude=51m});await Command(buyer,"SET_CART_ITEM",new{productId=product,quantity=2});
 var staleCart=await Assert.ThrowsAsync<CommerceConflict>(()=>Command(buyer,"SET_CART_ITEM",new{productId=product,quantity=9,expectedVersion=0}));Assert.Equal("CART_VERSION_CHANGED",staleCart.Message);
 Assert.Equal(2,JsonSerializer.Deserialize<Cart>((await db.Documents.AsNoTracking().SingleAsync(d=>d.Kind=="CART"&&d.OwnerId==buyer)).Body)!.Items[0].Quantity);
 var households=new Dictionary<Guid,Guid>{{buyer,Guid.NewGuid()},{stranger,Guid.NewGuid()}};
 foreach(var pair in households)await Command(admin,"LINK_HOUSEHOLD",new{accountId=pair.Key,householdKey=pair.Value,evidenceReference="CI verified household mapping"});
 var program=await Command(admin,"CREATE_PROGRAM",new{name="CI funded source",fundingReference="approved-ci-instruction",fundedRial=10000,expiresAtUtc=clock.UtcNow.AddDays(10),categoryIds=new[]{category}});
 var allocation=await Command(admin,"ALLOCATE_CREDIT",new{programId=program.GetProperty("Id").GetGuid(),poolRial=10000,beneficiaries=new[]{new{accountId=buyer,householdKey=households[buyer],geographicFactor=1m,scores=new{health=1,hardship=1,age=1,size=1,care=1,education=1}}}});
 var creditId=allocation.GetProperty("grants")[0].GetProperty("Id").GetGuid();
 var q=await Command(buyer,"CREATE_QUOTE",new{sellerId=seller,addressId,purchaseType="PERSONAL",fulfillmentMode="PICKUP"});
 var key=Guid.NewGuid();var input=new{quoteId=q.GetProperty("Id").GetGuid(),creditGrantId=creditId,unavailableDisposition="KEEP",confirmUnavailable=true};
 var publishedProduct=await catalog.Products.SingleAsync(p=>p.Id==product);publishedProduct.State=PublicationStates.Draft;await catalog.SaveChangesAsync();
 Assert.Empty(JsonSerializer.SerializeToElement(
  await service.PublicOffers(product,1,CancellationToken.None))
  .GetProperty("items").EnumerateArray());
 var unpublishedConflict=await Assert.ThrowsAsync<CommerceConflict>(()=>Command(buyer,"PLACE_ORDER",input,key));Assert.Equal("PRODUCT_NOT_PUBLISHED",unpublishedConflict.Message);
 Assert.Equal(10000,JsonSerializer.Deserialize<CreditGrant>((await db.Documents.AsNoTracking().SingleAsync(d=>d.Id==creditId)).Body)!.AvailableRial);
 await Command(buyer,"SET_CART_ITEM",new{productId=product,quantity=0});
 publishedProduct.State=PublicationStates.Published;await catalog.SaveChangesAsync();
 await Command(buyer,"SET_CART_ITEM",new{productId=product,quantity=2});
 var order=await Command(buyer,"PLACE_ORDER",input,key);var retry=await Command(buyer,"PLACE_ORDER",input,key);Assert.Equal(order.GetProperty("Id").GetGuid(),retry.GetProperty("Id").GetGuid());
 await Assert.ThrowsAsync<CommerceConflict>(()=>Command(buyer,"PLACE_ORDER",new{quoteId=input.quoteId,creditGrantId=creditId,unavailableDisposition="REMOVE"},key));
 Assert.Equal("CI product",order.GetProperty("Items")[0].GetProperty("ProductName").GetString());
 var orderId=order.GetProperty("Id").GetGuid();await Assert.ThrowsAsync<CommerceForbidden>(()=>Command(stranger,"CANCEL_ORDER",new{orderId,expectedVersion=1}));
 var cancelKey=Guid.NewGuid();await Command(buyer,"CANCEL_ORDER",new{orderId,expectedVersion=1},cancelKey);await Command(buyer,"CANCEL_ORDER",new{orderId,expectedVersion=1},cancelKey);
 var credit=JsonSerializer.Deserialize<CreditGrant>((await db.Documents.SingleAsync(d=>d.Id==creditId)).Body)!;Assert.Equal(10000,credit.AvailableRial);
 // New paid pickup, then confirmed receipt and support-approved damage.
 await Command(buyer,"SET_CART_ITEM",new{productId=product,quantity=1});q=await Command(buyer,"CREATE_QUOTE",new{sellerId=seller,addressId,purchaseType="PERSONAL",fulfillmentMode="PICKUP"});order=await Command(buyer,"PLACE_ORDER",new{quoteId=q.GetProperty("Id").GetGuid(),creditGrantId=creditId,unavailableDisposition="KEEP"});orderId=order.GetProperty("Id").GetGuid();
 var sellerStateKey=Guid.NewGuid();var sellerStateInput=new{orderId,expectedVersion=1,state="PREPARING"};await Command(seller,"SELLER_ORDER_STATE",sellerStateInput,sellerStateKey);await Command(seller,"SELLER_ORDER_STATE",sellerStateInput,sellerStateKey);await Command(seller,"SELLER_ORDER_STATE",new{orderId,expectedVersion=2,state="READY_FOR_PICKUP"});await Command(buyer,"CONFIRM_PICKUP",new{orderId,expectedVersion=3});
 await Assert.ThrowsAsync<CommerceConflict>(()=>Command(buyer,"CANCEL_ORDER",new{orderId,expectedVersion=4}));
 var image=await Command(buyer,"SAVE_EVIDENCE",new{contentType="image/png",contentBase64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII="});
 var evidenceId=image.GetProperty("evidenceId").GetGuid();
 await Assert.ThrowsAsync<CommerceMissing>(()=>service.EvidenceAsync(stranger,evidenceId,default));

 // An unreferenced owner image can be discarded idempotently, but another account cannot.
 var orphanImage=await Command(buyer,"SAVE_EVIDENCE",new{contentType="image/png",contentBase64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII="});
 var orphanEvidenceId=orphanImage.GetProperty("evidenceId").GetGuid();
 await Assert.ThrowsAsync<CommerceMissing>(()=>Command(stranger,"DELETE_EVIDENCE",new{evidenceId=orphanEvidenceId}));
 var discardKey=Guid.NewGuid();var discardInput=new{evidenceId=orphanEvidenceId};
 Assert.True((await Command(buyer,"DELETE_EVIDENCE",discardInput,discardKey)).GetProperty("deleted").GetBoolean());
 Assert.True((await Command(buyer,"DELETE_EVIDENCE",discardInput,discardKey)).GetProperty("deleted").GetBoolean());
 Assert.False(await db.Documents.AsNoTracking().AnyAsync(d=>d.Id==orphanEvidenceId&&d.Kind=="EVIDENCE"));

 var incident=await Command(buyer,"REPORT_INCIDENT",new{orderId,orderItemId=order.GetProperty("Items")[0].GetProperty("Id").GetGuid(),type="DAMAGED_ITEM",quantity=1,evidenceId});var incidentId=incident.GetProperty("Id").GetGuid();
 var evidenceInUse=await Assert.ThrowsAsync<CommerceConflict>(()=>Command(buyer,"DELETE_EVIDENCE",new{evidenceId}));
 Assert.Equal("EVIDENCE_IN_USE",evidenceInUse.Message);
 await Command(admin,"DECIDE_INCIDENT",new{incidentId,decision="APPROVE",reason="CI reviewed evidence"});
 var contactKey=Guid.NewGuid();var contactInput=new{incidentId,evidenceReference="CI first-call log"};await Command(seller,"RETURN_CONTACT",contactInput,contactKey);await Command(seller,"RETURN_CONTACT",contactInput,contactKey);
 var visitKey=Guid.NewGuid();var visitInput=new{incidentId,evidenceReference="CI door-visit log"};await Command(seller,"RETURN_VISIT",visitInput,visitKey);await Command(seller,"RETURN_VISIT",visitInput,visitKey);
 var stored=JsonSerializer.Deserialize<CreditGrant>((await db.Documents.SingleAsync(d=>d.Id==creditId)).Body)!;Assert.Equal(10000,stored.AvailableRial);
 clock.UtcNow=clock.UtcNow.AddHours(2);await Command(admin,"ASSESS_RETURN_SLA",new{});
 var late=JsonSerializer.Deserialize<Incident>((await db.Documents.SingleAsync(d=>d.Id==incidentId)).Body)!;Assert.True(late.PenaltyApplied);Assert.Null(late.CollectedAtUtc);
 Assert.True(await db.Journal.AnyAsync(j=>j.ActorId==buyer&&j.Event=="PLACE_ORDER"));
 // Content moderation and permission revocation must not be bypassed by cached results.
 var content=await Command(admin,"SAVE_CONTENT",new{slug="ci-policy",title="Policy",text="CI text",expectedVersion=0});
 Assert.Null(await service.PublicContent("ci-policy",default));
 await Command(admin,"PUBLISH_CONTENT",new{contentId=content.GetProperty("Id").GetGuid(),expectedVersion=1,published=true});Assert.NotNull(await service.PublicContent("ci-policy",default));
 await Command(admin,"SET_STAFF_PERMISSION",new{accountId=stranger,permission="FINANCE",active=true});
 var feeKey=Guid.NewGuid();var feeInput=new{version="ci-fee-v1",fixedInvoiceFeeRial=0,approvalReference="ci-approved-policy"};await Command(stranger,"SET_FEE_POLICY",feeInput,feeKey);
 await Assert.ThrowsAsync<CommerceForbidden>(()=>Command(stranger,"REPLY_TICKET",new{}));
 await Command(admin,"SET_STAFF_PERMISSION",new{accountId=stranger,permission="FINANCE",active=false});
 await Assert.ThrowsAsync<CommerceForbidden>(()=>Command(stranger,"SET_FEE_POLICY",feeInput,feeKey));

 // Exercise shipping HTTP authorization and independent DB contexts for the last-stock race.
 var tokens=new Dictionary<Guid,string>();foreach(var account in new[]{admin,seller,buyer,stranger}) {
  var token=SessionTokenCodec.Generate();SessionTokenCodec.TryComputeDigest(token,out var digest);tokens[account]=token;
  identity.AuthSessions.Add(new(){Id=Guid.NewGuid(),AccountId=account,TokenDigest=digest,IssuedAtUtc=DateTimeOffset.UtcNow.AddMinutes(-1),ExpiresAtUtc=DateTimeOffset.UtcNow.AddHours(1)});
 }await identity.SaveChangesAsync();
 using var factory=new WebApplicationFactory<Program>().WithWebHostBuilder(b=>{
  b.ConfigureServices(services=>{
   services.RemoveAll<HanaIdentityDbContext>();services.AddScoped(_=>new HanaIdentityDbContext(new DbContextOptionsBuilder<HanaIdentityDbContext>().UseNpgsql(connection).Options));
   services.RemoveAll<HanaCatalogDbContext>();services.AddScoped(_=>new HanaCatalogDbContext(new DbContextOptionsBuilder<HanaCatalogDbContext>().UseNpgsql(connection).Options));
   services.RemoveAll<HanaSellerDbContext>();services.AddScoped(_=>new HanaSellerDbContext(new DbContextOptionsBuilder<HanaSellerDbContext>().UseNpgsql(connection).Options));
   services.RemoveAll<HanaGeographyDbContext>();services.AddScoped(_=>new HanaGeographyDbContext(new DbContextOptionsBuilder<HanaGeographyDbContext>().UseNpgsql(connection).Options));
   services.RemoveAll<HanaCommerceDbContext>();services.AddScoped(_=>Context(connection));
  });
  b.UseEnvironment("Development");b.ConfigureAppConfiguration((_,config)=>config.AddInMemoryCollection(new Dictionary<string,string?>{["ConnectionStrings:IdentityDb"]=connection,["ConnectionStrings:CommerceDb"]=connection}));
 });
 using var anonymous=factory.CreateClient();using var customer=factory.CreateClient();using var other=factory.CreateClient();using var operatorClient=factory.CreateClient();using var storeClient=factory.CreateClient();
 customer.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",tokens[buyer]);other.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",tokens[stranger]);operatorClient.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",tokens[admin]);storeClient.DefaultRequestHeaders.Authorization=new AuthenticationHeaderValue("Bearer",tokens[seller]);
 async Task<HttpResponseMessage> Post(HttpClient client,string action,object body,Guid? commandId=null){using var request=new HttpRequestMessage(HttpMethod.Post,"/api/v1/commerce/commands/"+action){Content=JsonContent.Create(body)};request.Headers.Add("Idempotency-Key",(commandId??Guid.NewGuid()).ToString());return await client.SendAsync(request);}
 async Task<HttpResponseMessage> PostPath(HttpClient client,string path,object body,Guid? commandId=null){using var request=new HttpRequestMessage(HttpMethod.Post,path){Content=JsonContent.Create(body)};request.Headers.Add("Idempotency-Key",(commandId??Guid.NewGuid()).ToString());return await client.SendAsync(request);}
 Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.GetAsync("/api/v1/commerce/resources/ORDER")).StatusCode);
 Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.GetAsync("/api/v1/orders")).StatusCode);
 Assert.Equal(HttpStatusCode.OK,(await anonymous.GetAsync("/api/v1/content/ci-policy")).StatusCode);
 var publicOffers=await anonymous.GetAsync("/api/v1/offers?productId="+product);Assert.Equal(HttpStatusCode.OK,publicOffers.StatusCode);Assert.Single((await publicOffers.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").EnumerateArray());
 Assert.Equal(HttpStatusCode.BadRequest,(await anonymous.GetAsync("/api/v1/offers?page=0")).StatusCode);
 var publicServices=await anonymous.GetAsync("/api/v1/service-listings?productId="+serviceProduct);
 Assert.Equal(HttpStatusCode.OK,publicServices.StatusCode);
 var publicServiceBody=await publicServices.Content.ReadFromJsonAsync<JsonElement>();
 Assert.Single(publicServiceBody.GetProperty("items").EnumerateArray());
 Assert.Equal("CI weekdays 9-17",publicServiceBody.GetProperty("items")[0].GetProperty("AvailabilityNote").GetString());
 Assert.Equal(HttpStatusCode.BadRequest,(await anonymous.GetAsync("/api/v1/service-listings?page=0")).StatusCode);
 var sellerServices=await storeClient.GetAsync("/api/v1/seller/service-listings?page=1");
 Assert.Equal(HttpStatusCode.OK,sellerServices.StatusCode);
 Assert.Contains((await sellerServices.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").EnumerateArray(),
  x=>x.GetProperty("Id").GetGuid()==serviceListingId);
 Assert.Equal(HttpStatusCode.Forbidden,(await Post(customer,"SAVE_SERVICE_LISTING",new{
  listingId=Guid.NewGuid(),productId=serviceProduct,priceRial=1,
  availabilityNote="bad",expectedVersion=0})).StatusCode);
 Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.GetAsync("/api/v1/me/incidents")).StatusCode);
 var buyerIncidents=await customer.GetAsync("/api/v1/me/incidents?page=1");Assert.Equal(HttpStatusCode.OK,buyerIncidents.StatusCode);
 Assert.Single((await buyerIncidents.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").EnumerateArray());
 foreach(var client in new[]{other,operatorClient,storeClient}) {var ownIncidents=await client.GetAsync("/api/v1/me/incidents");Assert.Equal(HttpStatusCode.OK,ownIncidents.StatusCode);Assert.Empty((await ownIncidents.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").EnumerateArray());}
 var photoKey=Guid.NewGuid();var photoBody=new{contentType="image/png",contentBase64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII="};
 async Task<HttpResponseMessage> UploadPhoto(object body) {using var request=new HttpRequestMessage(HttpMethod.Post,"/api/v1/me/evidence"){Content=JsonContent.Create(body)};request.Headers.Add("Idempotency-Key",photoKey.ToString());return await customer.SendAsync(request);}
 var photoResponse=await UploadPhoto(photoBody);Assert.Equal(HttpStatusCode.OK,photoResponse.StatusCode);var savedPhoto=(await photoResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("evidenceId").GetGuid();
 var repeatedPhoto=await UploadPhoto(photoBody);Assert.Equal(HttpStatusCode.OK,repeatedPhoto.StatusCode);Assert.Equal(savedPhoto,(await repeatedPhoto.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("evidenceId").GetGuid());
 Assert.Equal(HttpStatusCode.Conflict,(await UploadPhoto(new{contentType="image/jpeg",contentBase64=photoBody.contentBase64})).StatusCode);
 Assert.Equal(HttpStatusCode.NotFound,(await other.GetAsync("/api/v1/evidence/"+savedPhoto)).StatusCode);
 var ownCredits=await customer.GetAsync("/api/v1/me/credits");Assert.Equal(HttpStatusCode.OK,ownCredits.StatusCode);
 Assert.Equal(HttpStatusCode.Forbidden,(await Post(customer,"CREATE_PROGRAM",new{})).StatusCode);
 Assert.Equal(HttpStatusCode.NotFound,(await other.GetAsync("/api/v1/commerce/resources/ORDER?id="+orderId)).StatusCode);
 Assert.Equal(HttpStatusCode.Forbidden,(await other.GetAsync("/api/v1/support/incidents?page=1")).StatusCode);
 var grantSupport=await Post(operatorClient,"SET_STAFF_PERMISSION",new{accountId=stranger,permission="SUPPORT",active=true});Assert.Equal(HttpStatusCode.OK,grantSupport.StatusCode);
 var supportIncidents=await other.GetAsync("/api/v1/support/incidents?page=1");Assert.Equal(HttpStatusCode.OK,supportIncidents.StatusCode);Assert.Contains((await supportIncidents.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").EnumerateArray(),x=>x.GetProperty("Id").GetGuid()==incidentId);
 var unavailable=await PostPath(other,"/api/v1/support/item-returns/"+incidentId+"/unavailability-decision",new{reason="CI verified timely call and visit"});
 Assert.Equal(HttpStatusCode.OK,unavailable.StatusCode);
 Assert.Equal("CUSTOMER_UNAVAILABLE_VERIFIED",(await unavailable.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("incident").GetProperty("State").GetString());
 var sellerIncidents=await storeClient.GetAsync("/api/v1/seller/incidents?page=1");Assert.Equal(HttpStatusCode.OK,sellerIncidents.StatusCode);Assert.Contains((await sellerIncidents.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("items").EnumerateArray(),x=>x.GetProperty("Id").GetGuid()==incidentId);
 Assert.Equal(HttpStatusCode.OK,(await other.GetAsync("/api/v1/evidence/"+evidenceId)).StatusCode);
 var currentOffer=JsonSerializer.Deserialize<Offer>((await db.Documents.AsNoTracking().SingleAsync(d=>d.Id==offerId)).Body)!;
 Assert.Equal(HttpStatusCode.OK,(await Post(storeClient,"SAVE_OFFER",new{offerId,productId=product,priceRial=1000,stock=1,expectedVersion=currentOffer.Version})).StatusCode);
 var p2=await Post(operatorClient,"CREATE_PROGRAM",new{name="Race CI",fundingReference="race-approved",fundedRial=4000,expiresAtUtc=DateTimeOffset.UtcNow.AddDays(1),categoryIds=new[]{category}});Assert.Equal(HttpStatusCode.OK,p2.StatusCode);
 var program2=(await p2.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("Id").GetGuid();
 var allocationResponse=await Post(operatorClient,"ALLOCATE_CREDIT",new{programId=program2,poolRial=4000,beneficiaries=new[]{buyer,stranger}.Select(a=>new{accountId=a,householdKey=households[a],geographicFactor=1m,scores=new{health=1,hardship=1,age=1,size=1,care=1,education=1}})});
 Assert.Equal(HttpStatusCode.OK,allocationResponse.StatusCode);var grants=(await allocationResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("grants").EnumerateArray().ToDictionary(g=>g.GetProperty("AccountId").GetGuid(),g=>g.GetProperty("Id").GetGuid());
 var quotes=new Dictionary<Guid,Guid>();foreach(var pair in new[]{(buyer,customer),(stranger,other)}) {
  var address=Guid.NewGuid();Assert.Equal(HttpStatusCode.OK,(await Post(pair.Item2,"SAVE_ADDRESS",new{addressId=address,cityId=city,text="Race CI",latitude=35,longitude=51})).StatusCode);
  Assert.Equal(HttpStatusCode.OK,(await Post(pair.Item2,"SET_CART_ITEM",new{productId=product,quantity=1})).StatusCode);
  var qr=await Post(pair.Item2,"CREATE_QUOTE",new{sellerId=seller,addressId=address,purchaseType="PERSONAL",fulfillmentMode="PICKUP"});Assert.Equal(HttpStatusCode.OK,qr.StatusCode);quotes[pair.Item1]=(await qr.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("Id").GetGuid();
 }
 var race=await Task.WhenAll(Post(customer,"PLACE_ORDER",new{quoteId=quotes[buyer],creditGrantId=grants[buyer],unavailableDisposition="KEEP"}),Post(other,"PLACE_ORDER",new{quoteId=quotes[stranger],creditGrantId=grants[stranger],unavailableDisposition="KEEP"}));
 Assert.Single(race,r=>r.StatusCode==HttpStatusCode.OK);Assert.Single(race,r=>r.StatusCode==HttpStatusCode.Conflict);
 db.ChangeTracker.Clear();Assert.Equal(0,JsonSerializer.Deserialize<Offer>((await db.Documents.SingleAsync(d=>d.Id==offerId)).Body)!.Stock);
 // Only the isolated fixture seeds provider-confirmed cash; production has no cash-mint endpoint.
 db.ChangeTracker.Clear();var walletDoc=await db.Documents.SingleAsync(d=>d.Kind=="WALLET"&&d.OwnerId==buyer);walletDoc.Body=JsonSerializer.Serialize(new CashWallet(buyer,100));walletDoc.Revision++;await db.SaveChangesAsync();
 var tinyProgram=await Command(admin,"CREATE_PROGRAM",new{name="Rounding CI",fundingReference="rounding-approved",fundedRial=1,expiresAtUtc=clock.UtcNow.AddDays(1),categoryIds=new[]{category}});
 var tinyAllocation=await Command(admin,"ALLOCATE_CREDIT",new{programId=tinyProgram.GetProperty("Id").GetGuid(),poolRial=1,beneficiaries=new[]{new{accountId=buyer,householdKey=households[buyer],geographicFactor=1m,scores=new{health=0,hardship=0,age=0,size=0,care=0,education=0}}}});var tinyCredit=tinyAllocation.GetProperty("grants")[0].GetProperty("Id").GetGuid();
 currentOffer=JsonSerializer.Deserialize<Offer>((await db.Documents.AsNoTracking().SingleAsync(d=>d.Id==offerId)).Body)!;
 await Command(seller,"SAVE_OFFER",new{offerId,productId=product,priceRial=1,stock=3,expectedVersion=currentOffer.Version});await Command(buyer,"SET_CART_ITEM",new{productId=product,quantity=3});
 q=await Command(buyer,"CREATE_QUOTE",new{sellerId=seller,addressId,purchaseType="PERSONAL",fulfillmentMode="PICKUP"});order=await Command(buyer,"PLACE_ORDER",new{quoteId=q.GetProperty("Id").GetGuid(),creditGrantId=tinyCredit,unavailableDisposition="KEEP"});orderId=order.GetProperty("Id").GetGuid();
 await Command(seller,"SELLER_ORDER_STATE",new{orderId,expectedVersion=1,state="PREPARING"});await Command(seller,"SELLER_ORDER_STATE",new{orderId,expectedVersion=2,state="READY_FOR_PICKUP"});await Command(buyer,"CONFIRM_PICKUP",new{orderId,expectedVersion=3});
 for(var n=0;n<3;n++) {
  var issue=await Command(buyer,"REPORT_INCIDENT",new{orderId,orderItemId=order.GetProperty("Items")[0].GetProperty("Id").GetGuid(),type="MISSING_ITEM",quantity=1,evidenceId});
  var shortageIncidentId=issue.GetProperty("Id").GetGuid();var decisionKey=Guid.NewGuid();var decisionBody=new{decision="APPROVE",reason="CI verified shortage"};var supportDecision=await PostPath(other,"/api/v1/support/incidents/"+shortageIncidentId+"/decision",decisionBody,decisionKey);Assert.Equal(HttpStatusCode.OK,supportDecision.StatusCode);var supportReplay=await PostPath(other,"/api/v1/support/incidents/"+shortageIncidentId+"/decision",decisionBody,decisionKey);Assert.Equal(HttpStatusCode.OK,supportReplay.StatusCode);
 }
 db.ChangeTracker.Clear();Assert.Equal(100,JsonSerializer.Deserialize<CashWallet>((await db.Documents.SingleAsync(d=>d.Kind=="WALLET"&&d.OwnerId==buyer)).Body)!.BalanceRial);Assert.Equal(1,JsonSerializer.Deserialize<CreditGrant>((await db.Documents.SingleAsync(d=>d.Id==tinyCredit)).Body)!.AvailableRial);
 var withdrawal=await Command(buyer,"REQUEST_WITHDRAWAL",new{amountRial=70,ibanVerificationRequestReference="ci-ownership-check-request"});var releaseKey=Guid.NewGuid();var release=new{withdrawalId=withdrawal.GetProperty("Id").GetGuid()};await Command(buyer,"CANCEL_WITHDRAWAL",release,releaseKey);await Command(buyer,"CANCEL_WITHDRAWAL",release,releaseKey);
 db.ChangeTracker.Clear();Assert.Equal(100,JsonSerializer.Deserialize<CashWallet>((await db.Documents.SingleAsync(d=>d.Kind=="WALLET"&&d.OwnerId==buyer)).Body)!.BalanceRial);

 // Timed jobs escalate once without pretending to transfer funds, and settlement preparation does not fabricate payment.
 withdrawal=await Command(buyer,"REQUEST_WITHDRAWAL",new{amountRial=70,ibanVerificationRequestReference="ci-pending-verification"});
 var lateWithdrawalId=withdrawal.GetProperty("Id").GetGuid();clock.UtcNow=clock.UtcNow.AddHours(73);
 Assert.Equal(1,(await Command(admin,"ASSESS_WITHDRAWAL_SLA",new{})).GetProperty("escalated").GetInt32());
 Assert.Equal(0,(await Command(admin,"ASSESS_WITHDRAWAL_SLA",new{})).GetProperty("escalated").GetInt32());
 var overdue=JsonSerializer.Deserialize<Withdrawal>((await db.Documents.AsNoTracking().SingleAsync(d=>d.Id==lateWithdrawalId)).Body)!;
 Assert.True(overdue.SlaEscalated);Assert.Equal("OWNERSHIP_VERIFICATION_PENDING",overdue.State);
 var afterWindow=await Assert.ThrowsAsync<CommerceConflict>(()=>Command(buyer,"REPORT_INCIDENT",new{orderId,orderItemId=order.GetProperty("Items")[0].GetProperty("Id").GetGuid(),type="MISSING_ITEM",quantity=1,evidenceId}));Assert.Equal("INCIDENT_WINDOW_EXPIRED",afterWindow.Message);
 var settlementRun=await Command(admin,"BUILD_SETTLEMENTS",new{});Assert.NotEmpty(settlementRun.EnumerateArray());
 Assert.All(settlementRun.EnumerateArray(),s=>Assert.Contains(s.GetProperty("State").GetString(),new[]{"READY_FOR_BANK_TRANSFER","FINANCE_REVIEW_REQUIRED"}));
 Assert.Empty((await Command(admin,"BUILD_SETTLEMENTS",new{})).EnumerateArray());

 // Seller report is server-scoped and aggregate-only.
 var sellerReportResponse=await storeClient.GetAsync("/api/v1/seller/report");
 Assert.Equal(HttpStatusCode.OK,sellerReportResponse.StatusCode);
 var sellerReport=await sellerReportResponse.Content.ReadFromJsonAsync<JsonElement>();
 var reportOrders=sellerReport.GetProperty("orders").GetInt32();
 Assert.True(reportOrders>0);
 Assert.Equal(reportOrders,
  sellerReport.GetProperty("paid").GetInt32()+
  sellerReport.GetProperty("preparing").GetInt32()+
  sellerReport.GetProperty("readyForPickup").GetInt32()+
  sellerReport.GetProperty("collected").GetInt32()+
  sellerReport.GetProperty("cancelled").GetInt32());
 Assert.True(sellerReport.GetProperty("grossRial").GetInt64()>=0);
 Assert.True(sellerReport.GetProperty("preparedSettlements").GetInt32()>=1);
 Assert.Equal(HttpStatusCode.Forbidden,(await customer.GetAsync("/api/v1/seller/report")).StatusCode);

 // Organization portal is scoped to explicit MANAGER membership and omits sensitive source/member identities.
 var organizationResponse=await Post(operatorClient,"CREATE_ORGANIZATION",new{name="CI organization",registrationReference="private-registration-ref"});
 Assert.Equal(HttpStatusCode.OK,organizationResponse.StatusCode);
 var organizationId=(await organizationResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("Id").GetGuid();
 Assert.Equal(HttpStatusCode.Forbidden,(await customer.GetAsync("/api/v1/organization/dashboard")).StatusCode);
 var managerResponse=await Post(operatorClient,"GRANT_ORGANIZATION_MEMBER",new{organizationId,accountId=stranger,role="MANAGER"});
 Assert.Equal(HttpStatusCode.OK,managerResponse.StatusCode);
 var beneficiaryResponse=await Post(operatorClient,"GRANT_ORGANIZATION_MEMBER",new{organizationId,accountId=buyer,role="BENEFICIARY"});
 Assert.Equal(HttpStatusCode.OK,beneficiaryResponse.StatusCode);
 var orgProgram=await Post(operatorClient,"CREATE_PROGRAM",new{name="CI organization program",fundingReference="private-funding-ref",fundedRial=5000,expiresAtUtc=DateTimeOffset.UtcNow.AddDays(30),categoryIds=new[]{category},organizationId});
 Assert.Equal(HttpStatusCode.OK,orgProgram.StatusCode);
 var organizationDashboard=await other.GetAsync("/api/v1/organization/dashboard");
 Assert.Equal(HttpStatusCode.OK,organizationDashboard.StatusCode);
 var organizationBody=await organizationDashboard.Content.ReadFromJsonAsync<JsonElement>();
 Assert.Equal("CI organization",organizationBody.GetProperty("organizations")[0].GetProperty("name").GetString());
 Assert.Equal(1,organizationBody.GetProperty("organizations")[0].GetProperty("beneficiaryCount").GetInt32());
 Assert.Equal("CI organization program",organizationBody.GetProperty("programs")[0].GetProperty("name").GetString());
 var organizationJson=organizationBody.GetRawText();
 Assert.DoesNotContain("private-registration-ref",organizationJson);
 Assert.DoesNotContain("private-funding-ref",organizationJson);
 Assert.DoesNotContain(buyer.ToString(),organizationJson,StringComparison.OrdinalIgnoreCase);
 var membershipId=(await managerResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("Id").GetGuid();
 Assert.Equal(HttpStatusCode.OK,(await Post(operatorClient,"REVOKE_ORGANIZATION_MEMBER",new{membershipId})).StatusCode);
 Assert.Equal(HttpStatusCode.Forbidden,(await other.GetAsync("/api/v1/organization/dashboard")).StatusCode);

 // Public offers must disappear when the seller loses activation; cached mutation replay must also fail.
 var savedOffer=JsonSerializer.Deserialize<Offer>((await db.Documents.AsNoTracking().SingleAsync(d=>d.Id==offerId)).Body)!;
 var offerKey=Guid.NewGuid();var offerPayload=new{offerId,productId=product,priceRial=1,stock=0,expectedVersion=savedOffer.Version};
 await Command(seller,"SAVE_OFFER",offerPayload,offerKey);
 sellers.SellerActivations.Remove(await sellers.SellerActivations.SingleAsync(s=>s.ApplicationAccountId==seller));await sellers.SaveChangesAsync();
 Assert.Empty(JsonSerializer.SerializeToElement(await service.PublicOffers(product,1,CancellationToken.None)).GetProperty("items").EnumerateArray());
 await Assert.ThrowsAsync<CommerceForbidden>(()=>Command(seller,"SAVE_OFFER",offerPayload,offerKey));

 }
 private static HanaCommerceDbContext Context(string connection)=>new(new DbContextOptionsBuilder<HanaCommerceDbContext>().UseNpgsql(connection,p=>p.MigrationsHistoryTable("__EFMigrationsHistory","commerce")).Options);
 private sealed class Clock:IClock {public DateTimeOffset UtcNow{get;set;}}
}
