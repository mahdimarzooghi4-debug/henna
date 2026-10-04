using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Hana.Application.Time;
using Hana.Domain.Credit;
using Hana.Infrastructure.Catalog;
using Hana.Infrastructure.Geography;
using Hana.Infrastructure.Identity;
using Hana.Infrastructure.Seller;
using Microsoft.EntityFrameworkCore;
namespace Hana.Infrastructure.Commerce;
public sealed class CommerceService(HanaCommerceDbContext db,HanaCatalogDbContext catalog,HanaSellerDbContext sellers,
 HanaGeographyDbContext geography,HanaIdentityDbContext identity,RoleAuthorizationService roles,IClock clock)
{
 private Guid transactionActor,transactionCommand;
 public async Task<JsonElement> ExecuteAsync(Guid actor,Guid command,string action,JsonElement input,CancellationToken ct=default)
 {
  db.ChangeTracker.Clear();
  if(actor==Guid.Empty || command==Guid.Empty || input.ValueKind!=JsonValueKind.Object) throw new ArgumentException("Command required.");
  var privileged=new[]{"CREATE_PROGRAM","ALLOCATE_CREDIT","DECIDE_INCIDENT","VERIFY_UNAVAILABILITY","ASSESS_RETURN_SLA","SET_FEE_POLICY","BUILD_SETTLEMENTS","REPLY_TICKET","SAVE_CONTENT","PUBLISH_CONTENT","CREATE_ORGANIZATION","GRANT_ORGANIZATION_MEMBER","REVOKE_ORGANIZATION_MEMBER"};
  var finance=new[]{"CREATE_PROGRAM","ALLOCATE_CREDIT","LINK_HOUSEHOLD","SET_FEE_POLICY","BUILD_SETTLEMENTS","ASSESS_WITHDRAWAL_SLA"};
  var support=new[]{"DECIDE_INCIDENT","VERIFY_UNAVAILABILITY","ASSESS_RETURN_SLA","REPLY_TICKET"};
  if(finance.Contains(action))await Permission(actor,"FINANCE",ct);
  else if(support.Contains(action))await Permission(actor,"SUPPORT",ct);
  else if(privileged.Contains(action)||action=="SET_STAFF_PERMISSION")await Admin(actor,ct);
  if(new[]{"SAVE_OFFER","SELLER_ORDER_STATE","RETURN_CONTACT","RETURN_VISIT"}.Contains(action))await Seller(actor,ct);
  transactionActor=actor;transactionCommand=command;
  // Pilot correctness boundary: serialize commerce mutations across API processes. Never an in-memory lock.
  await using var tx=await db.Database.BeginTransactionAsync(ct);
  await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(48710261004)",ct);
  // Re-read permissions after waiting for another transaction, including cached command replay.
  if(finance.Contains(action))await Permission(actor,"FINANCE",ct);
  else if(support.Contains(action))await Permission(actor,"SUPPORT",ct);
  else if(privileged.Contains(action)||action=="SET_STAFF_PERMISSION")await Admin(actor,ct);
  if(new[]{"SAVE_OFFER","SELLER_ORDER_STATE","RETURN_CONTACT","RETURN_VISIT"}.Contains(action))await Seller(actor,ct);
  var fingerprint=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(action+Canonical(input))));
  var prior=await db.Receipts.SingleOrDefaultAsync(x=>x.ActorId==actor && x.CommandId==command,ct);
  if(prior!=null) { if(prior.Fingerprint!=fingerprint) throw new CommerceConflict("IDEMPOTENCY_PAYLOAD_CHANGED"); return JsonSerializer.Deserialize<JsonElement>(prior.ResultJson); }
  if(await db.Receipts.CountAsync(r=>r.ActorId==actor&&r.CreatedAtUtc>clock.UtcNow.AddMinutes(-1),ct)>=120)
   throw new CommerceConflict("COMMAND_RATE_LIMITED");
  object result=action switch {
   "SAVE_OFFER"=>await SaveOffer(actor,input,ct), "SET_CART_ITEM"=>await SetCart(actor,input,ct), "COMPARE_CART"=>await CompareCart(actor,ct),
   "SAVE_ADDRESS"=>await SaveAddress(actor,input,ct), "CREATE_QUOTE"=>await CreateQuote(actor,input,ct),
   "PLACE_ORDER"=>await PlaceOrder(actor,input,ct), "CANCEL_ORDER"=>await Cancel(actor,input,ct),
   "SELLER_ORDER_STATE"=>await SellerState(actor,input,ct), "CONFIRM_PICKUP"=>await ConfirmPickup(actor,input,ct),
   "CREATE_PROGRAM"=>await CreateProgram(actor,input,ct), "ALLOCATE_CREDIT"=>await Allocate(actor,input,ct),
   "REPORT_INCIDENT"=>await ReportIncident(actor,input,ct), "DECIDE_INCIDENT"=>await DecideIncident(actor,input,ct),
   "RETURN_CONTACT"=>await ReturnContact(actor,input,ct), "RETURN_VISIT"=>await ReturnVisit(actor,input,ct),
   "CONFIRM_RETURN"=>await ConfirmReturn(actor,input,ct), "VERIFY_UNAVAILABILITY"=>await VerifyUnavailable(actor,input,ct),
   "ASSESS_WITHDRAWAL_SLA"=>await AssessWithdrawals(actor,ct),
   "ASSESS_RETURN_SLA"=>await AssessReturns(actor,ct), "SET_FEE_POLICY"=>await SetFee(actor,input,ct),
   "BUILD_SETTLEMENTS"=>await BuildSettlements(actor,ct), "REQUEST_WITHDRAWAL"=>await Withdraw(actor,input,ct), "CANCEL_WITHDRAWAL"=>await CancelWithdrawal(actor,input,ct),
   "SAVE_EVIDENCE"=>await SaveEvidence(actor,input,ct),
   "LINK_HOUSEHOLD"=>await LinkHousehold(actor,input,ct),
   "SET_STAFF_PERMISSION"=>await SetPermission(actor,input,ct),
   "CREATE_ORGANIZATION"=>await CreateOrganization(actor,input,ct), "GRANT_ORGANIZATION_MEMBER"=>await GrantMembership(actor,input,ct), "REVOKE_ORGANIZATION_MEMBER"=>await RevokeMembership(actor,input,ct),
   "SAVE_CONTENT"=>await SaveContent(actor,input,ct), "PUBLISH_CONTENT"=>await PublishContent(actor,input,ct), "READ_NOTIFICATION"=>await MarkNotification(actor,input,ct),
   "OPEN_TICKET"=>await OpenTicket(actor,input,ct), "REPLY_TICKET"=>await ReplyTicket(actor,input,ct),
   _=>throw new ArgumentException("Unknown command.") };
  if(result is Order changed) {
   var receiver=action=="SELLER_ORDER_STATE"?changed.BuyerId:changed.SellerId;
   await Notify(receiver,action,changed.Id,ct);
  }
  if(result is SupportTicket ticket && action=="REPLY_TICKET")await Notify(ticket.AccountId,action,ticket.Id,ct);
  var json=JsonSerializer.Serialize(result);
  db.Receipts.Add(new(){ActorId=actor,CommandId=command,Fingerprint=fingerprint,ResultJson=json,CreatedAtUtc=clock.UtcNow});
  // Transactional outbox/audit event. Delivery integrations consume it later; not an SMS sent flag.
  db.Journal.Add(new(){Id=Guid.NewGuid(),ActorId=actor,CommandId=command,ResourceId=command,Event=action,Body=JsonSerializer.Serialize(new{input=action=="SAVE_EVIDENCE"?JsonSerializer.SerializeToElement(new{contentOmitted=true}):input,result}),CreatedAtUtc=clock.UtcNow});
  await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);return JsonSerializer.Deserialize<JsonElement>(json);
 }
 private void Transfer(Guid resource,string debit,string credit,long amount,string fundKind) {
  if(amount==0)return;if(amount<0)throw new ArgumentException("Negative journal amount.");
  db.Journal.Add(new(){Id=Guid.NewGuid(),ActorId=transactionActor,CommandId=transactionCommand,ResourceId=resource,Event="MONEY_TRANSFER",Body=JsonSerializer.Serialize(new{debitAccount=debit,creditAccount=credit,amountRial=amount,currency="IRR",fundKind}),CreatedAtUtc=clock.UtcNow});
 }
 private static string Canonical(JsonElement x)=>x.ValueKind switch {
  JsonValueKind.Object=>"{"+string.Join(",",x.EnumerateObject().OrderBy(p=>p.Name,StringComparer.Ordinal).Select(p=>JsonSerializer.Serialize(p.Name)+":"+Canonical(p.Value)))+"}",
  JsonValueKind.Array=>"["+string.Join(",",x.EnumerateArray().Select(Canonical))+"]",
  _=>x.GetRawText() };
 private static Guid Id(JsonElement x,string key) { if(!x.TryGetProperty(key,out var p)||!p.TryGetGuid(out var id)||id==Guid.Empty) throw new ArgumentException(key);return id; }
 private static string Text(JsonElement x,string key,int max=240) { if(!x.TryGetProperty(key,out var p)||p.ValueKind!=JsonValueKind.String||string.IsNullOrWhiteSpace(p.GetString())||p.GetString()!.Length>max) throw new ArgumentException(key);return p.GetString()!.Trim(); }
 private static long Money(JsonElement x,string key,bool zero=false) { if(!x.TryGetProperty(key,out var p)||!p.TryGetInt64(out var n)||n<(zero?0:1)) throw new ArgumentException(key);return n; }
 private static int Count(JsonElement x,string key,int min=1,int max=999) { if(!x.TryGetProperty(key,out var p)||!p.TryGetInt32(out var n)||n<min||n>max) throw new ArgumentException(key);return n; }
 private static DateTimeOffset Utc(JsonElement x,string key) { if(!x.TryGetProperty(key,out var p)||!p.TryGetDateTimeOffset(out var n)||n.Offset!=TimeSpan.Zero) throw new ArgumentException(key);return n; }
 private async Task Admin(Guid actor,CancellationToken ct) { if(!await roles.HasRoleAsync(actor,HanaRoles.Admin,ct)) throw new CommerceForbidden(); }
 private async Task<object> SaveEvidence(Guid actor,JsonElement x,CancellationToken ct) {
  var mime=Text(x,"contentType",40);if(mime is not("image/png" or "image/jpeg" or "image/webp"))throw new ArgumentException("Evidence image format.");
  var data=Convert.FromBase64String(Text(x,"contentBase64",55000));if(data.Length is <12 or >40000)throw new ArgumentException("Evidence image size.");
  bool valid=mime switch {"image/png"=>data.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}),"image/jpeg"=>data[0]==255&&data[1]==216&&data[^2]==255&&data[^1]==217,"image/webp"=>Encoding.ASCII.GetString(data,0,4)=="RIFF"&&Encoding.ASCII.GetString(data,8,4)=="WEBP",_=>false};
  if(!valid)throw new ArgumentException("Evidence file signature.");var e=new CommerceEvidence(Guid.NewGuid(),actor,mime,Convert.ToBase64String(data),Convert.ToHexString(SHA256.HashData(data)),clock.UtcNow);await Put(e.Id,actor,"EVIDENCE",e,ct);return new{evidenceId=e.Id,sha256=e.Sha256,contentType=mime,size=data.Length};
 }
 public async Task<CommerceEvidence> EvidenceAsync(Guid actor,Guid id,CancellationToken ct) {
  var e=await Get<CommerceEvidence>(id,"EVIDENCE",ct);if(e.AccountId==actor||await HasPermission(actor,"SUPPORT",ct))return e;
  var referenced=(await All<Incident>("INCIDENT",ct)).Any(i=>i.SellerId==actor&&i.EvidenceReference==id.ToString());if(referenced){await Seller(actor,ct);return e;}throw new CommerceMissing();
 }
 private async Task<object> LinkHousehold(Guid actor,JsonElement x,CancellationToken ct) {
  await Permission(actor,"FINANCE",ct);var account=Id(x,"accountId");if(!await identity.Accounts.AnyAsync(a=>a.Id==account,ct))throw new CommerceMissing();var prior=await Owned<CommerceHouseholdLink>(account,"HOUSEHOLD",ct);
  var link=new CommerceHouseholdLink(prior?.Id??Guid.NewGuid(),account,Id(x,"householdKey"),Text(x,"evidenceReference"));await Put(link.Id,account,"HOUSEHOLD",link,ct);return link;
 }
 private async Task<bool> HasPermission(Guid actor,string permission,CancellationToken ct) {
  if(await roles.HasRoleAsync(actor,HanaRoles.Admin,ct))return true;
  var selector=JsonSerializer.Serialize(new{Permission=permission,Active=true});
  return await db.Documents.AsNoTracking().AnyAsync(d=>d.Kind=="PERMISSION"&&d.OwnerId==actor&&EF.Functions.JsonContains(d.Body,selector),ct);
 }
 private async Task Permission(Guid actor,string permission,CancellationToken ct) {if(!await HasPermission(actor,permission,ct))throw new CommerceForbidden();}
 private async Task<object> SetPermission(Guid actor,JsonElement x,CancellationToken ct) {
  await Admin(actor,ct);var target=Id(x,"accountId");if(!await identity.Accounts.AnyAsync(a=>a.Id==target,ct))throw new CommerceMissing();var permission=Text(x,"permission");if(permission is not("FINANCE" or "SUPPORT"))throw new ArgumentException("Permission.");
  var active=x.GetProperty("active").GetBoolean();var prior=(await All<CommerceStaffPermission>("PERMISSION",ct)).SingleOrDefault(p=>p.AccountId==target&&p.Permission==permission);var p=new CommerceStaffPermission(prior?.Id??Guid.NewGuid(),target,permission,active);await Put(p.Id,target,"PERMISSION",p,ct);return p;
 }
 private async Task Seller(Guid actor,CancellationToken ct) { if(!await roles.HasRoleAsync(actor,HanaRoles.Seller,ct)||!await sellers.SellerActivations.AnyAsync(x=>x.ApplicationAccountId==actor,ct)) throw new CommerceForbidden(); }
 private async Task<T> Get<T>(Guid id,string kind,CancellationToken ct) { var d=await db.Documents.SingleOrDefaultAsync(x=>x.Id==id&&x.Kind==kind,ct)??throw new CommerceMissing();return JsonSerializer.Deserialize<T>(d.Body)!; }
 private async Task<T?> Owned<T>(Guid owner,string kind,CancellationToken ct) where T:class {var d=await db.Documents.SingleOrDefaultAsync(x=>x.OwnerId==owner&&x.Kind==kind,ct);return d==null?null:JsonSerializer.Deserialize<T>(d.Body);}
 private async Task Put(Guid id,Guid owner,string kind,object value,CancellationToken ct) { var d=await db.Documents.SingleOrDefaultAsync(x=>x.Id==id,ct);if(d==null)db.Documents.Add(new(){Id=id,OwnerId=owner,Kind=kind,Body=JsonSerializer.Serialize(value),Revision=1});else {if(d.Kind!=kind||d.OwnerId!=owner)throw new CommerceConflict("RESOURCE_ID_COLLISION");d.Body=JsonSerializer.Serialize(value);d.Revision=checked(d.Revision+1);} }
 private async Task<List<T>> All<T>(string kind,CancellationToken ct) {var rows=await db.Documents.Where(x=>x.Kind==kind).OrderBy(x=>x.Id).ToListAsync(ct);return rows.Select(x=>JsonSerializer.Deserialize<T>(x.Body)!).ToList();}
 private async Task<object> SaveOffer(Guid actor,JsonElement x,CancellationToken ct) {
  await Seller(actor,ct);var product=await catalog.Products.AsNoTracking().SingleOrDefaultAsync(p=>p.Id==Id(x,"productId")&&p.State==PublicationStates.Published&&p.Kind==CatalogProductKinds.Good,ct)??throw new CommerceConflict("PRODUCT_NOT_PUBLISHED");
  if(!await catalog.Categories.AnyAsync(c=>c.Id==product.CategoryId&&c.State==PublicationStates.Published,ct))throw new CommerceConflict("CATEGORY_NOT_PUBLISHED");
  var offerId=Id(x,"offerId");var old=(await All<Offer>("OFFER",ct)).SingleOrDefault(o=>o.SellerId==actor&&o.ProductId==product.Id);
  if(old!=null&&(old.Id!=offerId||old.Version!=Count(x,"expectedVersion",0,int.MaxValue)))throw new CommerceConflict("OFFER_VERSION_CHANGED");
  if(old==null&&Count(x,"expectedVersion",0,int.MaxValue)!=0)throw new CommerceConflict("OFFER_VERSION_CHANGED");
  var offer=new Offer(offerId,actor,product.Id,product.CategoryId,Money(x,"priceRial"),Count(x,"stock",0,1000000),checked((old?.Version??0)+1),true);
  await Put(offer.Id,actor,"OFFER",offer,ct);return offer;
 }
 private async Task<object> SetCart(Guid actor,JsonElement x,CancellationToken ct) {
  var productId=Id(x,"productId");if(!await catalog.Products.AnyAsync(p=>p.Id==productId&&p.State==PublicationStates.Published,ct))throw new CommerceMissing();
  var cart=await Owned<Cart>(actor,"CART",ct)??new(Guid.NewGuid(),actor,[]);var quantity=Count(x,"quantity",0);
  cart.Items.RemoveAll(i=>i.ProductId==productId);if(quantity>0)cart.Items.Add(new(productId,quantity));if(cart.Items.Count>100)throw new ArgumentException("Cart limit.");await Put(cart.Id,actor,"CART",cart,ct);return cart;
 }
 public Task<object> ComparisonAsync(Guid actor,CancellationToken ct=default)=>CompareCart(actor,ct);
 private async Task<object> CompareCart(Guid actor,CancellationToken ct) {
  var cart=await Owned<Cart>(actor,"CART",ct)??new(Guid.NewGuid(),actor,[]);var offers=await All<Offer>("OFFER",ct);var active=await ActiveSellers(ct);var result=new List<object>();
  foreach(var seller in offers.Where(o=>o.Published).Select(o=>o.SellerId).Distinct()) {
   if(!active.Contains(seller))continue;
   var available=new List<QuoteItem>();var missing=new List<CartItem>();foreach(var item in cart.Items){var offer=offers.SingleOrDefault(o=>o.SellerId==seller&&o.ProductId==item.ProductId&&o.Published&&o.Stock>=item.Quantity);if(offer==null)missing.Add(item);else available.Add(new(offer.Id,offer.ProductId,item.Quantity,offer.PriceRial,offer.Version));}
   if(available.Count>0)result.Add(new{sellerId=seller,available,unavailable=missing,itemsTotalRial=available.Aggregate(0L,(n,i)=>checked(n+checked(i.UnitPriceRial*i.Quantity)))});
  }return result;
 }
 private async Task<object> SaveAddress(Guid actor,JsonElement x,CancellationToken ct) {
  var cityId=Id(x,"cityId");if(!await geography.Cities.AnyAsync(c=>c.Id==cityId&&c.State==GeographyStates.Selectable,ct))throw new CommerceMissing();
  if(!x.TryGetProperty("latitude",out var lat)||!lat.TryGetDecimal(out var latitude)||latitude is < -90 or >90||!x.TryGetProperty("longitude",out var lon)||!lon.TryGetDecimal(out var longitude)||longitude is < -180 or >180)throw new ArgumentException("Coordinates.");
  var id=Id(x,"addressId");var a=new BuyerAddress(id,actor,cityId,Text(x,"text",1000),latitude,longitude);await Put(id,actor,"ADDRESS",a,ct);return a;
 }
 private async Task<object> CreateQuote(Guid actor,JsonElement x,CancellationToken ct) {
  var seller=Id(x,"sellerId");await Seller(seller,ct);var address=await Get<BuyerAddress>(Id(x,"addressId"),"ADDRESS",ct);if(address.BuyerId!=actor)throw new CommerceForbidden();
  var store=await sellers.RegistrationDrafts.AsNoTracking().SingleAsync(s=>s.AccountId==seller,ct);
  if(store.Pickup!=true||store.ActivityCityId!=address.CityId)throw new CommerceConflict("PICKUP_COVERAGE_UNAVAILABLE");
  var purchase=Text(x,"purchaseType");if(purchase is not("PERSONAL" or "LEGAL"))throw new ArgumentException("Purchase type.");
  var mode=Text(x,"fulfillmentMode");if(mode!="PICKUP")throw new CommerceConflict("DELIVERY_INTEGRATION_UNCONFIGURED");
  var cart=await Owned<Cart>(actor,"CART",ct)??throw new CommerceConflict("CART_EMPTY");var offers=(await All<Offer>("OFFER",ct)).Where(o=>o.SellerId==seller&&o.Published).ToList();var items=new List<QuoteItem>();var missing=new List<CartItem>();
  foreach(var item in cart.Items) {var o=offers.SingleOrDefault(o=>o.ProductId==item.ProductId&&o.Stock>=item.Quantity);if(o==null)missing.Add(item);else items.Add(new(o.Id,o.ProductId,item.Quantity,o.PriceRial,o.Version));}
  if(items.Count==0)throw new CommerceConflict("NO_AVAILABLE_ITEMS");var total=items.Aggregate(0L,(n,i)=>checked(n+checked(i.UnitPriceRial*i.Quantity)));
  var q=new Quote(Guid.NewGuid(),actor,seller,address.Id,purchase,mode,items,missing,total,clock.UtcNow.AddMinutes(5),false);await Put(q.Id,actor,"QUOTE",q,ct);return q;
 }
 private async Task<object> CreateProgram(Guid actor,JsonElement x,CancellationToken ct) {
  await Permission(actor,"FINANCE",ct);var expiry=Utc(x,"expiresAtUtc");if(expiry<=clock.UtcNow)throw new ArgumentException("Expiry.");var categories=x.GetProperty("categoryIds").EnumerateArray().Select(p=>p.GetGuid()).Distinct().ToList();if(categories.Count is <1 or >100)throw new ArgumentException("Categories.");
  if(await catalog.Categories.CountAsync(c=>categories.Contains(c.Id)&&c.State==PublicationStates.Published,ct)!=categories.Count)throw new ArgumentException("Categories.");
  Guid? organization=null;if(x.TryGetProperty("organizationId",out var org)&&org.ValueKind!=JsonValueKind.Null){organization=org.GetGuid();await Get<CommerceOrganization>(organization.Value,"ORGANIZATION",ct);}
  var p=new CreditProgram(Guid.NewGuid(),Text(x,"name",120),Text(x,"fundingReference"),Money(x,"fundedRial"),Money(x,"fundedRial"),expiry,categories,organization);await Put(p.Id,actor,"PROGRAM",p,ct);Transfer(p.Id,"APPROVED_SOURCE:"+p.FundingReference,"PROGRAM_AVAILABLE:"+p.Id,p.FundedRial,"SUPPORT");return p;
 }
 private async Task<object> Allocate(Guid actor,JsonElement x,CancellationToken ct) {
  await Permission(actor,"FINANCE",ct);var program=await Get<CreditProgram>(Id(x,"programId"),"PROGRAM",ct);if(program.ExpiresAtUtc<=clock.UtcNow)throw new CommerceConflict("PROGRAM_EXPIRED");
  var beneficiaries=x.GetProperty("beneficiaries").EnumerateArray().ToArray();if(beneficiaries.Length is <1 or >500)throw new ArgumentException("Beneficiaries.");var pool=Money(x,"poolRial");if(pool>program.UnallocatedRial)throw new CommerceConflict("PROGRAM_FUNDS_INSUFFICIENT");
  var links=await All<CommerceHouseholdLink>("HOUSEHOLD",ct);
  var householdIds=new HashSet<Guid>();
  var existingGrants=await All<CreditGrant>("CREDIT",ct);
  var weights=new List<(Guid Account,Guid Household,decimal Weight)>();foreach(var b in beneficiaries){var account=Id(b,"accountId");var household=Id(b,"householdKey");if(!links.Any(l=>l.AccountId==account&&l.HouseholdKey==household))throw new CommerceConflict("HOUSEHOLD_LINK_REQUIRED");if(!householdIds.Add(household))throw new ArgumentException("Duplicate household.");if(existingGrants.Any(g=>g.ProgramId==program.Id&&(g.AccountId==account||g.HouseholdKey==household)))throw new CommerceConflict("HOUSEHOLD_ALREADY_ALLOCATED");if(program.OrganizationId is Guid orgId && !(await All<OrganizationMembership>("MEMBERSHIP",ct)).Any(m=>m.OrganizationId==orgId&&m.AccountId==account&&m.Role=="BENEFICIARY"))throw new CommerceForbidden();if(!await identity.Accounts.AnyAsync(a=>a.Id==account,ct))throw new CommerceMissing();var s=b.GetProperty("scores");var scores=new HouseholdNeedScores(Count(s,"health",0,3),Count(s,"hardship",0,3),Count(s,"age",0,3),Count(s,"size",0,3),Count(s,"care",0,3),Count(s,"education",0,3));var g=b.GetProperty("geographicFactor").GetDecimal();if(g<=0)throw new ArgumentException("Geography.");weights.Add((account,household,NeedsBasedAllocationV1.CalculateHouseholdFactor(scores)*g));}
  if(weights.Select(w=>w.Account).Distinct().Count()!=weights.Count)throw new ArgumentException("Duplicate beneficiary.");var sum=weights.Sum(w=>w.Weight);long assigned=0;var grants=new List<CreditGrant>();
  foreach(var w in weights){var amount=checked((long)decimal.Floor(pool*w.Weight/sum));assigned=checked(assigned+amount);var grant=new CreditGrant(Guid.NewGuid(),w.Account,program.Id,amount,amount,program.ExpiresAtUtc,program.CategoryIds,w.Household);await Put(grant.Id,w.Account,"CREDIT",grant,ct);Transfer(grant.Id,"PROGRAM_AVAILABLE:"+program.Id,"HOUSEHOLD_CREDIT:"+grant.Id,amount,"SUPPORT");grants.Add(grant);}
  var owner=(await db.Documents.SingleAsync(d=>d.Id==program.Id,ct)).OwnerId;await Put(program.Id,owner,"PROGRAM",program with{UnallocatedRial=program.UnallocatedRial-assigned},ct);
  return new{grants,unallocatedRial=pool-assigned,formulaVersion=AllocationWeightProfile.Baseline.Version};
 }
 private async Task<(CommerceDocument? Document,CashWallet Wallet)> Wallet(Guid actor,CancellationToken ct) {var d=await db.Documents.SingleOrDefaultAsync(d=>d.Kind=="WALLET"&&d.OwnerId==actor,ct);return(d,d==null?new(actor,0):JsonSerializer.Deserialize<CashWallet>(d.Body)!);}
 private async Task SetWallet(Guid actor,long balance,CancellationToken ct) {if(balance<0)throw new CommerceConflict("WALLET_FUNDS_INSUFFICIENT");var w=await Wallet(actor,ct);await Put(w.Document?.Id??Guid.NewGuid(),actor,"WALLET",new CashWallet(actor,balance),ct);}
 private async Task<object> PlaceOrder(Guid actor,JsonElement x,CancellationToken ct) {
  var q=await Get<Quote>(Id(x,"quoteId"),"QUOTE",ct);if(q.BuyerId!=actor)throw new CommerceForbidden();if(q.Used||q.ExpiresAtUtc<=clock.UtcNow)throw new CommerceConflict("QUOTE_EXPIRED_OR_USED");await Seller(q.SellerId,ct);
  var disposition=Text(x,"unavailableDisposition");if(disposition is not("KEEP" or "REMOVE"))throw new ArgumentException("Explicit cart disposition.");
  if(q.Unavailable.Count>0&&(!x.TryGetProperty("confirmUnavailable",out var confirmation)||confirmation.ValueKind!=JsonValueKind.True))throw new CommerceConflict("PARTIAL_BASKET_CONFIRMATION_REQUIRED");
  var address=await Get<BuyerAddress>(q.AddressId,"ADDRESS",ct);var actual=new List<(QuoteItem Item,Offer Offer)>();foreach(var item in q.Items){var offer=await Get<Offer>(item.OfferId,"OFFER",ct);if(!offer.Published||offer.Version!=item.OfferVersion||offer.PriceRial!=item.UnitPriceRial||offer.Stock<item.Quantity)throw new CommerceConflict("QUOTE_CHANGED");actual.Add((item,offer));}
  CreditGrant? grant=null;long credit=0;
  if(x.TryGetProperty("creditGrantId",out var creditId)&&creditId.ValueKind!=JsonValueKind.Null){grant=await Get<CreditGrant>(creditId.GetGuid(),"CREDIT",ct);if(grant.AccountId!=actor)throw new CommerceForbidden();if(q.PurchaseType!="PERSONAL"||grant.ExpiresAtUtc<=clock.UtcNow||actual.Any(i=>!grant.CategoryIds.Contains(i.Offer.CategoryId)))throw new CommerceConflict("CREDIT_NOT_ELIGIBLE");credit=Math.Min(grant.AvailableRial,q.ItemsTotalRial);}
  var cash=q.ItemsTotalRial-credit;var wallet=await Wallet(actor,ct);if(wallet.Wallet.BalanceRial<cash)throw new CommerceConflict("PAYMENT_REQUIRED_PROVIDER_UNCONFIGURED");
  await SetWallet(actor,wallet.Wallet.BalanceRial-cash,ct);if(grant!=null)await Put(grant.Id,actor,"CREDIT",grant with{AvailableRial=grant.AvailableRial-credit},ct);
  var items=new List<OrderItem>();long remaining=credit;foreach(var(a,o)in actual){var value=checked(a.UnitPriceRial*a.Quantity);var part=Math.Min(remaining,value);remaining-=part;items.Add(new(Guid.NewGuid(),o.Id,o.ProductId,a.Quantity,a.UnitPriceRial,value-part,part,0));await Put(o.Id,o.SellerId,"OFFER",o with{Stock=o.Stock-a.Quantity,Version=checked(o.Version+1)},ct);}
  var order=new Order(Guid.NewGuid(),actor,q.SellerId,q.PurchaseType,q.FulfillmentMode,address,items,q.ItemsTotalRial,cash,credit,grant?.Id,"PAID","NONE",1,clock.UtcNow,null,null);
  Transfer(order.Id,"BUYER_CASH:"+actor,"ORDER_CASH:"+order.Id,cash,"CASH");Transfer(order.Id,"HOUSEHOLD_CREDIT:"+grant?.Id,"ORDER_CREDIT:"+order.Id,credit,"SUPPORT");
  await Put(order.Id,actor,"ORDER",order,ct);await Put(q.Id,actor,"QUOTE",q with{Used=true},ct);
  var cart=await Owned<Cart>(actor,"CART",ct);if(cart!=null){foreach(var item in q.Items){var current=cart.Items.Find(i=>i.ProductId==item.ProductId);if(current!=null){cart.Items.Remove(current);if(current.Quantity>item.Quantity)cart.Items.Add(current with{Quantity=current.Quantity-item.Quantity});}}if(disposition=="REMOVE")cart.Items.RemoveAll(i=>q.Unavailable.Any(u=>u.ProductId==i.ProductId));await Put(cart.Id,actor,"CART",cart,ct);}return order;
 }
 private static void Version(Order o,JsonElement x) {if(o.Version!=Count(x,"expectedVersion",1,int.MaxValue))throw new CommerceConflict("ORDER_VERSION_CHANGED");}
 private async Task Refund(Order o,long cash,long credit,CancellationToken ct) {
  Transfer(o.Id,"ORDER_CASH:"+o.Id,"BUYER_CASH:"+o.BuyerId,cash,"CASH");Transfer(o.Id,"ORDER_CREDIT:"+o.Id,"HOUSEHOLD_CREDIT:"+o.CreditGrantId,credit,"SUPPORT");
  var wallet=await Wallet(o.BuyerId,ct);await SetWallet(o.BuyerId,checked(wallet.Wallet.BalanceRial+cash),ct);
  if(credit>0&&o.CreditGrantId is Guid grantId){var g=await Get<CreditGrant>(grantId,"CREDIT",ct);await Put(g.Id,o.BuyerId,"CREDIT",g with{AvailableRial=checked(g.AvailableRial+credit)},ct);}
 }
 private async Task<object> Cancel(Guid actor,JsonElement x,CancellationToken ct) {
  var o=await Get<Order>(Id(x,"orderId"),"ORDER",ct);if(o.BuyerId!=actor)throw new CommerceForbidden();Version(o,x);if(o.State is "COLLECTED" or "CANCELLED"||o.HandoffAtUtc!=null)throw new CommerceConflict("CANCEL_CUTOFF_PASSED");
  await Refund(o,o.CashPaidRial,o.CreditPaidRial,ct);foreach(var item in o.Items){var offer=await Get<Offer>(item.OfferId,"OFFER",ct);await Put(offer.Id,offer.SellerId,"OFFER",offer with{Stock=checked(offer.Stock+item.Quantity),Version=checked(offer.Version+1)},ct);}
  o=o with{State="CANCELLED",RefundState="REFUNDED",Version=checked(o.Version+1)};await Put(o.Id,o.BuyerId,"ORDER",o,ct);return o;
 }
 private async Task<object> SellerState(Guid actor,JsonElement x,CancellationToken ct) {
  await Seller(actor,ct);var o=await Get<Order>(Id(x,"orderId"),"ORDER",ct);if(o.SellerId!=actor)throw new CommerceForbidden();Version(o,x);var target=Text(x,"state");if(!(o.State=="PAID"&&target=="PREPARING"||o.State=="PREPARING"&&target=="READY_FOR_PICKUP"))throw new CommerceConflict("ORDER_TRANSITION_INVALID");o=o with{State=target,Version=checked(o.Version+1)};await Put(o.Id,o.BuyerId,"ORDER",o,ct);return o;
 }
 private async Task<object> ConfirmPickup(Guid actor,JsonElement x,CancellationToken ct) {
  var o=await Get<Order>(Id(x,"orderId"),"ORDER",ct);if(o.BuyerId!=actor)throw new CommerceForbidden();Version(o,x);if(o.State!="READY_FOR_PICKUP"||o.FulfillmentMode!="PICKUP")throw new CommerceConflict("ORDER_TRANSITION_INVALID");o=o with{State="COLLECTED",ReceivedAtUtc=clock.UtcNow,Version=checked(o.Version+1)};await Put(o.Id,o.BuyerId,"ORDER",o,ct);return o;
 }
 private async Task<object> ReportIncident(Guid actor,JsonElement x,CancellationToken ct) {
  var o=await Get<Order>(Id(x,"orderId"),"ORDER",ct);if(o.BuyerId!=actor)throw new CommerceForbidden();if(o.ReceivedAtUtc==null||clock.UtcNow>o.ReceivedAtUtc.Value.AddHours(1))throw new CommerceConflict("INCIDENT_WINDOW_EXPIRED");
  var item=o.Items.SingleOrDefault(i=>i.Id==Id(x,"orderItemId"))??throw new CommerceMissing();var quantity=Count(x,"quantity");var type=Text(x,"type");if(type is not("DAMAGED_ITEM" or "MISSING_ITEM"))throw new ArgumentException("Incident type.");
  var pending=(await All<Incident>("INCIDENT",ct)).Where(i=>i.OrderItemId==item.Id&&i.State=="UNDER_REVIEW").Sum(i=>i.Quantity);
  if(quantity>item.Quantity-item.RefundedQuantity-pending)throw new CommerceConflict("INCIDENT_QUANTITY_EXCEEDED");
  var evidenceId=Id(x,"evidenceId");var evidence=await Get<CommerceEvidence>(evidenceId,"EVIDENCE",ct);if(evidence.AccountId!=actor)throw new CommerceForbidden();
  var incident=new Incident(Guid.NewGuid(),o.Id,item.Id,actor,o.SellerId,type,quantity,evidenceId.ToString(),"UNDER_REVIEW",clock.UtcNow,null,null,null,null,null,false,0);
  await Put(incident.Id,actor,"INCIDENT",incident,ct);return incident;
 }
 private async Task<object> DecideIncident(Guid actor,JsonElement x,CancellationToken ct) {
  await Permission(actor,"SUPPORT",ct);var i=await Get<Incident>(Id(x,"incidentId"),"INCIDENT",ct);if(i.State!="UNDER_REVIEW")throw new CommerceConflict("INCIDENT_ALREADY_DECIDED");var decision=Text(x,"decision");var reason=Text(x,"reason",1000);
  if(decision=="REJECT"){i=i with{State="REJECTED"};await Put(i.Id,i.BuyerId,"INCIDENT",i,ct);return new{incident=i,reason};}
  if(decision!="APPROVE")throw new ArgumentException("Decision.");var o=await Get<Order>(i.OrderId,"ORDER",ct);var item=o.Items.Single(t=>t.Id==i.OrderItemId);
  if(i.Quantity>item.Quantity-item.RefundedQuantity)throw new CommerceConflict("REFUND_LIMIT_EXCEEDED");
  // Difference of cumulative fractions makes repeated partial refunds add up exactly.
  var before=decimal.Floor((decimal)item.CreditRial*item.RefundedQuantity/item.Quantity);
  var after=decimal.Floor((decimal)item.CreditRial*(item.RefundedQuantity+i.Quantity)/item.Quantity);
  var credit=checked((long)(after-before));var amount=checked(item.UnitPriceRial*i.Quantity);await Refund(o,amount-credit,credit,ct);
  var updated=o.Items.Select(t=>t.Id==item.Id?t with{RefundedQuantity=t.RefundedQuantity+i.Quantity}:t).ToList();
  o=o with{Items=updated,RefundState=updated.All(t=>t.RefundedQuantity==t.Quantity)?"REFUNDED":"PARTIAL",Version=checked(o.Version+1)};
  await Put(o.Id,o.BuyerId,"ORDER",o,ct);i=i with{State=i.Type=="DAMAGED_ITEM"?"AWAITING_RETURN":"RESOLVED",ApprovedAtUtc=clock.UtcNow,ReturnDueAtUtc=i.Type=="DAMAGED_ITEM"?clock.UtcNow.AddHours(1):null,RefundRial=amount};await Put(i.Id,i.BuyerId,"INCIDENT",i,ct);return new{incident=i,reason};
 }
 private async Task<object> ReturnContact(Guid actor,JsonElement x,CancellationToken ct) {
  await Seller(actor,ct);var i=await Get<Incident>(Id(x,"incidentId"),"INCIDENT",ct);if(i.SellerId!=actor)throw new CommerceForbidden();if(i.State!="AWAITING_RETURN"||i.FirstContactAtUtc!=null)throw new CommerceConflict("RETURN_STATE_INVALID");
  var evidence=Text(x,"evidenceReference");i=i with{FirstContactAtUtc=clock.UtcNow};await Put(i.Id,i.BuyerId,"INCIDENT",i,ct);return new{incident=i,evidence};
 }
 private async Task<object> ReturnVisit(Guid actor,JsonElement x,CancellationToken ct) {
  await Seller(actor,ct);var i=await Get<Incident>(Id(x,"incidentId"),"INCIDENT",ct);if(i.SellerId!=actor)throw new CommerceForbidden();if(i.State!="AWAITING_RETURN"||i.FirstContactAtUtc==null||i.DoorVisitAtUtc!=null)throw new CommerceConflict("RETURN_CONTACT_REQUIRED");
  var evidence=Text(x,"evidenceReference");i=i with{DoorVisitAtUtc=clock.UtcNow};await Put(i.Id,i.BuyerId,"INCIDENT",i,ct);return new{incident=i,evidence};
 }
 private async Task<object> ConfirmReturn(Guid actor,JsonElement x,CancellationToken ct) {
  // Buyer confirms actual physical collection; seller alone cannot fabricate receipt.
  var i=await Get<Incident>(Id(x,"incidentId"),"INCIDENT",ct);if(i.BuyerId!=actor)throw new CommerceForbidden();if(i.State!="AWAITING_RETURN")throw new CommerceConflict("RETURN_STATE_INVALID");
  i=i with{State="COLLECTED",CollectedAtUtc=clock.UtcNow,PenaltyApplied=clock.UtcNow>i.ReturnDueAtUtc};await Put(i.Id,i.BuyerId,"INCIDENT",i,ct);return i;
 }
 private async Task<object> VerifyUnavailable(Guid actor,JsonElement x,CancellationToken ct) {
  await Permission(actor,"SUPPORT",ct);var i=await Get<Incident>(Id(x,"incidentId"),"INCIDENT",ct);if(i.State!="AWAITING_RETURN"||i.FirstContactAtUtc==null||i.DoorVisitAtUtc==null||i.DoorVisitAtUtc>i.ReturnDueAtUtc)throw new CommerceConflict("TIMELY_CALL_AND_DOOR_EVIDENCE_REQUIRED");
  if((await All<Settlement>("SETTLEMENT",ct)).Any(s=>s.OrderId==i.OrderId))throw new CommerceConflict("SETTLEMENT_ALREADY_PREPARED");
  var reason=Text(x,"reason",1000);i=i with{State="CUSTOMER_UNAVAILABLE_VERIFIED",PenaltyApplied=false};await Put(i.Id,i.BuyerId,"INCIDENT",i,ct);return new{incident=i,reason};
 }
 private async Task<object> AssessReturns(Guid actor,CancellationToken ct) {
  await Permission(actor,"SUPPORT",ct);var incidents=await All<Incident>("INCIDENT",ct);int assessed=0;foreach(var i in incidents.Where(i=>i.State=="AWAITING_RETURN"&&i.ReturnDueAtUtc<clock.UtcNow&&!i.PenaltyApplied)){await Put(i.Id,i.BuyerId,"INCIDENT",i with{PenaltyApplied=true},ct);assessed++;}return new{assessed};
 }
 private async Task<object> SetFee(Guid actor,JsonElement x,CancellationToken ct) {
  await Permission(actor,"FINANCE",ct);var fee=new FeePolicy(Guid.NewGuid(),Text(x,"version",120),Money(x,"fixedInvoiceFeeRial",true),Text(x,"approvalReference"));
  if((await All<FeePolicy>("FEE_VERSION",ct)).Any(p=>p.Version==fee.Version))throw new CommerceConflict("FEE_VERSION_ALREADY_EXISTS");
  var historical=fee with{Id=Guid.NewGuid()};await Put(historical.Id,Guid.Empty,"FEE_VERSION",historical,ct);
  var old=await Owned<FeePolicy>(Guid.Empty,"FEE",ct);if(old!=null)fee=fee with{Id=old.Id};await Put(fee.Id,Guid.Empty,"FEE",fee,ct);return fee;
 }
 private async Task<object> BuildSettlements(Guid actor,CancellationToken ct) {
  await Permission(actor,"FINANCE",ct);var fee=await Owned<FeePolicy>(Guid.Empty,"FEE",ct)??throw new CommerceConflict("FEE_POLICY_UNCONFIGURED");var orders=await All<Order>("ORDER",ct);var incidents=await All<Incident>("INCIDENT",ct);var existing=await All<Settlement>("SETTLEMENT",ct);var result=new List<Settlement>();
  // Only prior Iran calendar days. No bank transfer or PAID status is fabricated.
  var iran=TimeZoneInfo.FindSystemTimeZoneById("Asia/Tehran");var day=DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.UtcNow,iran).DateTime);
  foreach(var o in orders.Where(o=>o.State=="COLLECTED"&&o.ReceivedAtUtc!=null&&o.ReceivedAtUtc.Value.AddHours(1)<clock.UtcNow&&DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(o.ReceivedAtUtc.Value,iran).DateTime)<day&&!existing.Any(s=>s.OrderId==o.Id))){
   var cases=incidents.Where(i=>i.OrderId==o.Id).ToList();if(cases.Any(i=>i.State=="UNDER_REVIEW"||i.State=="AWAITING_RETURN"&&!i.PenaltyApplied))continue;
   long refund=cases.Sum(i=>i.RefundRial),penalty=cases.Where(i=>i.PenaltyApplied).Sum(i=>i.RefundRial);var net=checked(o.TotalRial-refund-penalty-fee.FixedInvoiceFeeRial);
   var s=new Settlement(Guid.NewGuid(),o.Id,o.SellerId,o.TotalRial,refund,penalty,fee.FixedInvoiceFeeRial,fee.Version,net,net<0?"FINANCE_REVIEW_REQUIRED":"READY_FOR_BANK_TRANSFER",clock.UtcNow);await Put(s.Id,o.SellerId,"SETTLEMENT",s,ct);result.Add(s);
  }return result;
 }
 private async Task<object> Withdraw(Guid actor,JsonElement x,CancellationToken ct) {
  // Ownership verification connector is unconfigured: accept a request but hold funds pending verification.
  var amount=Money(x,"amountRial");var reference=Text(x,"ibanVerificationRequestReference");var wallet=await Wallet(actor,ct);if(wallet.Wallet.BalanceRial<amount)throw new CommerceConflict("WALLET_FUNDS_INSUFFICIENT");await SetWallet(actor,wallet.Wallet.BalanceRial-amount,ct);
  var w=new Withdrawal(Guid.NewGuid(),actor,amount,reference,"OWNERSHIP_VERIFICATION_PENDING",clock.UtcNow,clock.UtcNow.AddHours(72));Transfer(w.Id,"BUYER_CASH:"+actor,"WITHDRAWAL_HOLD:"+w.Id,amount,"CASH");await Put(w.Id,actor,"WITHDRAWAL",w,ct);return w;
 }
 private async Task<object> AssessWithdrawals(Guid actor,CancellationToken ct) {
  await Permission(actor,"FINANCE",ct);var withdrawals=await All<Withdrawal>("WITHDRAWAL",ct);int count=0;
  foreach(var w in withdrawals.Where(w=>w.State=="OWNERSHIP_VERIFICATION_PENDING"&&!w.SlaEscalated&&w.DueAtUtc<clock.UtcNow)) {
   await Put(w.Id,w.BuyerId,"WITHDRAWAL",w with{SlaEscalated=true},ct);await Notify(w.BuyerId,"WITHDRAWAL_SLA_BREACHED",w.Id,ct);count++;
  }return new{escalated=count};
 }
 private async Task<object> CancelWithdrawal(Guid actor,JsonElement x,CancellationToken ct) {
  var w=await Get<Withdrawal>(Id(x,"withdrawalId"),"WITHDRAWAL",ct);if(w.BuyerId!=actor)throw new CommerceForbidden();if(w.State!="OWNERSHIP_VERIFICATION_PENDING")throw new CommerceConflict("WITHDRAWAL_STATE_INVALID");var wallet=await Wallet(actor,ct);await SetWallet(actor,checked(wallet.Wallet.BalanceRial+w.AmountRial),ct);Transfer(w.Id,"WITHDRAWAL_HOLD:"+w.Id,"BUYER_CASH:"+actor,w.AmountRial,"CASH");w=w with{State="CANCELLED"};await Put(w.Id,actor,"WITHDRAWAL",w,ct);return w;
 }
 private async Task<object> OpenTicket(Guid actor,JsonElement x,CancellationToken ct) {var t=new SupportTicket(Guid.NewGuid(),actor,Text(x,"subject",120),Text(x,"message",2000),"OPEN",clock.UtcNow,null);await Put(t.Id,actor,"TICKET",t,ct);return t;}
 private async Task<object> ReplyTicket(Guid actor,JsonElement x,CancellationToken ct) {await Permission(actor,"SUPPORT",ct);var t=await Get<SupportTicket>(Id(x,"ticketId"),"TICKET",ct);t=t with{State="ANSWERED",Reply=Text(x,"reply",2000)};await Put(t.Id,t.AccountId,"TICKET",t,ct);return t;}
 private async Task<object> CreateOrganization(Guid actor,JsonElement x,CancellationToken ct) {
  await Admin(actor,ct);var organization=new CommerceOrganization(Guid.NewGuid(),Text(x,"name",200),Text(x,"registrationReference"));await Put(organization.Id,actor,"ORGANIZATION",organization,ct);return organization;
 }
 private async Task<object> GrantMembership(Guid actor,JsonElement x,CancellationToken ct) {
  await Admin(actor,ct);var orgId=Id(x,"organizationId");await Get<CommerceOrganization>(orgId,"ORGANIZATION",ct);var account=Id(x,"accountId");if(!await identity.Accounts.AnyAsync(a=>a.Id==account,ct))throw new CommerceMissing();
  var role=Text(x,"role");if(role is not("MANAGER" or "BENEFICIARY"))throw new ArgumentException("Organization role.");var old=(await All<OrganizationMembership>("MEMBERSHIP",ct)).SingleOrDefault(m=>m.OrganizationId==orgId&&m.AccountId==account&&m.Role==role);
  var m=new OrganizationMembership(old?.Id??Guid.NewGuid(),orgId,account,role);await Put(m.Id,account,"MEMBERSHIP",m,ct);return m;
 }
 private async Task<object> RevokeMembership(Guid actor,JsonElement x,CancellationToken ct) {
  await Admin(actor,ct);var m=await Get<OrganizationMembership>(Id(x,"membershipId"),"MEMBERSHIP",ct);m=m with{Role="REVOKED"};await Put(m.Id,m.AccountId,"MEMBERSHIP",m,ct);return m;
 }
 private async Task Notify(Guid receiver,string code,Guid resource,CancellationToken ct) {
  var n=new CommerceNotification(Guid.NewGuid(),receiver,code,resource,clock.UtcNow,false);await Put(n.Id,receiver,"NOTIFICATION",n,ct);
 }
 private async Task<object> MarkNotification(Guid actor,JsonElement x,CancellationToken ct) {
  var n=await Get<CommerceNotification>(Id(x,"notificationId"),"NOTIFICATION",ct);if(n.AccountId!=actor)throw new CommerceForbidden();n=n with{Read=true};await Put(n.Id,actor,"NOTIFICATION",n,ct);return n;
 }
 private async Task<object> SaveContent(Guid actor,JsonElement x,CancellationToken ct) {
  await Admin(actor,ct);var slug=Text(x,"slug",100);if(!System.Text.RegularExpressions.Regex.IsMatch(slug,"^[a-z0-9]+(?:-[a-z0-9]+)*$"))throw new ArgumentException("Slug.");
  var old=(await All<CommerceContent>("CONTENT",ct)).SingleOrDefault(c=>c.Slug==slug);
  if(Count(x,"expectedVersion",0,int.MaxValue)!=(old?.Version??0))throw new CommerceConflict("CONTENT_VERSION_CHANGED");
  var c=new CommerceContent(old?.Id??Guid.NewGuid(),slug,Text(x,"title",200),Text(x,"text",10000),false,checked((old?.Version??0)+1));await Put(c.Id,Guid.Empty,"CONTENT",c,ct);return c;
 }
 private async Task<object> PublishContent(Guid actor,JsonElement x,CancellationToken ct) {
  await Admin(actor,ct);var c=await Get<CommerceContent>(Id(x,"contentId"),"CONTENT",ct);if(Count(x,"expectedVersion",1,int.MaxValue)!=c.Version)throw new CommerceConflict("CONTENT_VERSION_CHANGED");
  c=c with{Published=x.GetProperty("published").GetBoolean(),Version=checked(c.Version+1)};await Put(c.Id,Guid.Empty,"CONTENT",c,ct);return c;
 }
 private async Task<Guid[]> ActiveSellers(CancellationToken ct) {
  var assigned=await identity.RoleAssignments.AsNoTracking().Where(r=>r.Role==HanaRoles.Seller).Select(r=>r.AccountId).ToArrayAsync(ct);
  return await sellers.SellerActivations.AsNoTracking().Where(s=>assigned.Contains(s.ApplicationAccountId)).Select(s=>s.ApplicationAccountId).ToArrayAsync(ct);
 }
 public async Task<object> PublicOffers(Guid? productId,int page,CancellationToken ct) {
  if(page is <1 or >10000)throw new ArgumentException("Page.");var active=await ActiveSellers(ct);
  var query=db.Documents.AsNoTracking().Where(d=>d.Kind=="OFFER"&&active.Contains(d.OwnerId)&&EF.Functions.JsonContains(d.Body,"{\"Published\":true}"));
  if(productId!=null){var selector=JsonSerializer.Serialize(new{ProductId=productId});query=query.Where(d=>EF.Functions.JsonContains(d.Body,selector));}
  var rows=await query.OrderBy(d=>d.Id).Skip((page-1)*20).Take(20).ToListAsync(ct);return new{items=rows.Select(d=>JsonSerializer.Deserialize<Offer>(d.Body)),page,pageSize=20};
 }
 public async Task<CommerceContent?> PublicContent(string slug,CancellationToken ct) {
  if(slug.Length>100)return null;
  var rows=await db.Documents.AsNoTracking().Where(d=>d.Kind=="CONTENT"&&EF.Functions.JsonContains(d.Body,JsonSerializer.Serialize(new{Slug=slug,Published=true}))).Take(1).ToListAsync(ct);
  return rows.Count==0?null:JsonSerializer.Deserialize<CommerceContent>(rows[0].Body);
 }
 public async Task<object> ReadAsync(Guid actor,string kind,Guid? id,int page,CancellationToken ct=default,string? view=null) {
  if(page is <1 or >10000)throw new ArgumentException("Page.");
  if(kind=="AUDIT") {
   await Admin(actor,ct);return new{items=await db.Journal.AsNoTracking().OrderByDescending(j=>j.CreatedAtUtc).ThenBy(j=>j.Id).Skip((page-1)*20).Take(20).Select(j=>new{j.Id,j.ActorId,j.CommandId,j.ResourceId,j.Event,j.CreatedAtUtc}).ToListAsync(ct),page};
  }
  if(kind=="SUMMARY") {
   await Admin(actor,ct);var orders=await All<Order>("ORDER",ct);var cases=await All<Incident>("INCIDENT",ct);var settlements=await All<Settlement>("SETTLEMENT",ct);
   return new{orders=orders.Count,cancelled=orders.Count(o=>o.State=="CANCELLED"),collected=orders.Count(o=>o.State=="COLLECTED"),openIncidents=cases.Count(i=>i.State is "UNDER_REVIEW" or "AWAITING_RETURN"),preparedSettlements=settlements.Count,grossRial=orders.Where(o=>o.State!="CANCELLED").Aggregate(0L,(n,o)=>checked(n+o.TotalRial))};
  }
  var allowed=new[]{"OFFER","CART","ADDRESS","QUOTE","ORDER","WALLET","CREDIT","PROGRAM","INCIDENT","SETTLEMENT","WITHDRAWAL","TICKET","NOTIFICATION","CONTENT","ORGANIZATION","MEMBERSHIP","PERMISSION","FEE_VERSION","HOUSEHOLD"};if(!allowed.Contains(kind))throw new ArgumentException("Resource kind.");
  var admin=await roles.HasRoleAsync(actor,HanaRoles.Admin,ct);
  var supportAccess=new[]{"ORDER","INCIDENT","TICKET"}.Contains(kind)&&await HasPermission(actor,"SUPPORT",ct);
  var financeAccess=new[]{"PROGRAM","CREDIT","SETTLEMENT","WITHDRAWAL","FEE_VERSION"}.Contains(kind)&&await HasPermission(actor,"FINANCE",ct);
  admin=admin||supportAccess||financeAccess;
  var query=db.Documents.AsNoTracking().Where(d=>d.Kind==kind);
  if(kind=="OFFER") {var active=await ActiveSellers(ct);query=query.Where(d=>active.Contains(d.OwnerId)&&EF.Functions.JsonContains(d.Body,"{\"Published\":true}"));}
  if(id!=null)query=query.Where(d=>d.Id==id);
  if(view=="BUYER")query=query.Where(d=>d.OwnerId==actor);
  if(view=="SELLER") {await Seller(actor,ct);query=kind=="ORDER"?query.Where(d=>EF.Functions.JsonContains(d.Body,JsonSerializer.Serialize(new{SellerId=actor}))):query.Where(d=>d.OwnerId==actor);}
  var sellerAccess=await roles.HasRoleAsync(actor,HanaRoles.Seller,ct)&&await sellers.SellerActivations.AnyAsync(s=>s.ApplicationAccountId==actor,ct);
  var memberships=await db.Documents.AsNoTracking().Where(d=>d.Kind=="MEMBERSHIP"&&d.OwnerId==actor).ToListAsync(ct);
  var organizations=memberships.Select(d=>JsonSerializer.Deserialize<OrganizationMembership>(d.Body)!).Where(m=>m.Role=="MANAGER").Select(m=>m.OrganizationId).ToArray();
  if(!admin&&kind!="OFFER") {
   if(kind=="ORDER"||kind=="INCIDENT")query=query.Where(d=>d.OwnerId==actor||sellerAccess&&EF.Functions.JsonContains(d.Body,JsonSerializer.Serialize(new{SellerId=actor})));
   else if(kind=="ORGANIZATION")query=query.Where(d=>d.OwnerId==actor||organizations.Contains(d.Id));
   else if(kind=="PROGRAM") {
    var scoped=query.Where(d=>d.OwnerId==actor);
    foreach(var organization in organizations) {var selector=JsonSerializer.Serialize(new{OrganizationId=organization});scoped=scoped.Union(query.Where(d=>EF.Functions.JsonContains(d.Body,selector)));}
    query=scoped;
   }
   else query=query.Where(d=>d.OwnerId==actor);
  }
  var rows=await query.OrderBy(d=>d.Id).Skip(id==null?(page-1)*20:0).Take(id==null?20:1).ToListAsync(ct);
  var result=new List<JsonElement>();foreach(var d in rows){var body=JsonSerializer.Deserialize<JsonElement>(d.Body);
   bool visible=admin||kind=="PROGRAM"&&organizations.Contains(body.GetProperty("OrganizationId").ValueKind==JsonValueKind.Null?Guid.Empty:body.GetProperty("OrganizationId").GetGuid())||kind=="ORGANIZATION"&&organizations.Contains(d.Id)||d.OwnerId==actor||kind=="OFFER"||sellerAccess&&kind=="ORDER"&&body.GetProperty("SellerId").GetGuid()==actor||sellerAccess&&kind=="INCIDENT"&&body.GetProperty("SellerId").GetGuid()==actor;
   if(visible)result.Add(body);
  }
  if(id!=null&&result.Count==0)throw new CommerceMissing();return new{items=result,page,pageSize=20};
 }
}
