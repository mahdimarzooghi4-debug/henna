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
namespace Hana.Infrastructure.Tests;
public sealed class CommerceTests
{
 [Fact] public void SnapshotMatchesModel() {
  using var db=Context("Host=localhost;Database=check");var snapshot=db.GetService<IMigrationsAssembly>().ModelSnapshot!;
  var prior=db.GetService<IModelRuntimeInitializer>().Initialize(snapshot.Model,true);
  Assert.Empty(db.GetService<IMigrationsModelDiffer>().GetDifferences(prior.GetRelationalModel(),db.GetService<IDesignTimeModel>().Model.GetRelationalModel()));
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
 var category=Guid.NewGuid();var product=Guid.NewGuid();catalog.Categories.Add(new(){Id=category,Name="CI food",Slug="ci-"+category,State=PublicationStates.Published,CreatedAtUtc=clock.UtcNow});catalog.Products.Add(new(){Id=product,CategoryId=category,Name="CI product",State=PublicationStates.Published,CreatedAtUtc=clock.UtcNow});await catalog.SaveChangesAsync();
 geo.Provinces.Add(new(){Id=province,Name="CI",Slug="ci-"+province,State=GeographyStates.Selectable});geo.Cities.Add(new(){Id=city,ProvinceId=province,Name="CI",Slug="ci-"+city,State=GeographyStates.Selectable});await geo.SaveChangesAsync();
 var draft=await sellers.RegistrationDrafts.SingleAsync(d=>d.AccountId==seller);
 draft.CompletedStep=5;draft.ApplicantType="NATURAL";draft.NaturalNationalCode="0013549829";draft.IdentityStatus="VERIFIED";
 draft.BusinessCategoryId=Guid.NewGuid();sellers.BusinessCategories.Add(new(){Id=draft.BusinessCategoryId.Value,Name="CI",IsActive=true,UpdatedAtUtc=clock.UtcNow});
 draft.BusinessName="CI";draft.BusinessDescription="CI";draft.BusinessPhone="02112345678";draft.ServiceArea="CI city";draft.OfferingType="GOOD";draft.ActivityProvinceId=province;draft.ActivityCityId=city;draft.ActivityAddress="CI";draft.ActivityHours="CI";draft.Pickup=true;draft.SellerDelivery=false;
 await sellers.SaveChangesAsync();
 var roles=new RoleAuthorizationService(identity,new AuthSessionService(identity,clock));var service=new CommerceService(db,catalog,sellers,geo,identity,roles,clock);
 Task<JsonElement> Command(Guid actor,string action,object input,Guid? key=null)=>service.ExecuteAsync(actor,key??Guid.NewGuid(),action,JsonSerializer.SerializeToElement(input));
 var offerId=Guid.NewGuid();await Command(seller,"SAVE_OFFER",new{offerId,productId=product,priceRial=1000,stock=5,expectedVersion=0});
 await Assert.ThrowsAsync<CommerceForbidden>(()=>Command(buyer,"SAVE_OFFER",new{}));
 var addressId=Guid.NewGuid();await Command(buyer,"SAVE_ADDRESS",new{addressId,cityId=city,text="CI only",latitude=35m,longitude=51m});await Command(buyer,"SET_CART_ITEM",new{productId=product,quantity=2});
 var program=await Command(admin,"CREATE_PROGRAM",new{name="CI funded source",fundingReference="approved-ci-instruction",fundedRial=10000,expiresAtUtc=clock.UtcNow.AddDays(10),categoryIds=new[]{category}});
 var allocation=await Command(admin,"ALLOCATE_CREDIT",new{programId=program.GetProperty("Id").GetGuid(),poolRial=10000,beneficiaries=new[]{new{accountId=buyer,geographicFactor=1m,scores=new{health=1,hardship=1,age=1,size=1,care=1,education=1}}}});
 var creditId=allocation.GetProperty("grants")[0].GetProperty("Id").GetGuid();
 var q=await Command(buyer,"CREATE_QUOTE",new{sellerId=seller,addressId,purchaseType="PERSONAL",fulfillmentMode="PICKUP"});
 var key=Guid.NewGuid();var input=new{quoteId=q.GetProperty("Id").GetGuid(),creditGrantId=creditId,unavailableDisposition="KEEP",confirmUnavailable=true};
 var order=await Command(buyer,"PLACE_ORDER",input,key);var retry=await Command(buyer,"PLACE_ORDER",input,key);Assert.Equal(order.GetProperty("Id").GetGuid(),retry.GetProperty("Id").GetGuid());
 await Assert.ThrowsAsync<CommerceConflict>(()=>Command(buyer,"PLACE_ORDER",new{quoteId=input.quoteId,creditGrantId=creditId,unavailableDisposition="REMOVE"},key));
 var orderId=order.GetProperty("Id").GetGuid();await Assert.ThrowsAsync<CommerceForbidden>(()=>Command(stranger,"CANCEL_ORDER",new{orderId,expectedVersion=1}));
 var cancelKey=Guid.NewGuid();await Command(buyer,"CANCEL_ORDER",new{orderId,expectedVersion=1},cancelKey);await Command(buyer,"CANCEL_ORDER",new{orderId,expectedVersion=1},cancelKey);
 var credit=JsonSerializer.Deserialize<CreditGrant>((await db.Documents.SingleAsync(d=>d.Id==creditId)).Body)!;Assert.Equal(10000,credit.AvailableRial);
 // New paid pickup, then confirmed receipt and support-approved damage.
 await Command(buyer,"SET_CART_ITEM",new{productId=product,quantity=1});q=await Command(buyer,"CREATE_QUOTE",new{sellerId=seller,addressId,purchaseType="PERSONAL",fulfillmentMode="PICKUP"});order=await Command(buyer,"PLACE_ORDER",new{quoteId=q.GetProperty("Id").GetGuid(),creditGrantId=creditId,unavailableDisposition="KEEP"});orderId=order.GetProperty("Id").GetGuid();
 await Command(seller,"SELLER_ORDER_STATE",new{orderId,expectedVersion=1,state="PREPARING"});await Command(seller,"SELLER_ORDER_STATE",new{orderId,expectedVersion=2,state="READY_FOR_PICKUP"});await Command(buyer,"CONFIRM_PICKUP",new{orderId,expectedVersion=3});
 await Assert.ThrowsAsync<CommerceConflict>(()=>Command(buyer,"CANCEL_ORDER",new{orderId,expectedVersion=4}));
 var incident=await Command(buyer,"REPORT_INCIDENT",new{orderId,orderItemId=order.GetProperty("Items")[0].GetProperty("Id").GetGuid(),type="DAMAGED_ITEM",quantity=1,evidenceReference="ci-photo"});var incidentId=incident.GetProperty("Id").GetGuid();
 await Command(admin,"DECIDE_INCIDENT",new{incidentId,decision="APPROVE",reason="CI reviewed evidence"});
 var stored=JsonSerializer.Deserialize<CreditGrant>((await db.Documents.SingleAsync(d=>d.Id==creditId)).Body)!;Assert.Equal(10000,stored.AvailableRial);
 clock.UtcNow=clock.UtcNow.AddHours(2);await Command(admin,"ASSESS_RETURN_SLA",new{});
 var late=JsonSerializer.Deserialize<Incident>((await db.Documents.SingleAsync(d=>d.Id==incidentId)).Body)!;Assert.True(late.PenaltyApplied);Assert.Null(late.CollectedAtUtc);
 Assert.True(await db.Journal.AnyAsync(j=>j.ActorId==buyer&&j.Event=="PLACE_ORDER"));
 }
 private static HanaCommerceDbContext Context(string connection)=>new(new DbContextOptionsBuilder<HanaCommerceDbContext>().UseNpgsql(connection,p=>p.MigrationsHistoryTable("__EFMigrationsHistory","commerce")).Options);
 private sealed class Clock:IClock {public DateTimeOffset UtcNow{get;set;}}
}
