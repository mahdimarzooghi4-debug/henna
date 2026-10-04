namespace Hana.Infrastructure.Commerce;
public sealed record Offer(Guid Id,Guid SellerId,Guid ProductId,Guid CategoryId,long PriceRial,int Stock,int Version,bool Published);
public sealed record CartItem(Guid ProductId,int Quantity);
public sealed record Cart(Guid Id,Guid BuyerId,List<CartItem> Items);
public sealed record BuyerAddress(Guid Id,Guid BuyerId,Guid CityId,string Text,decimal Latitude,decimal Longitude);
public sealed record QuoteItem(Guid OfferId,Guid ProductId,int Quantity,long UnitPriceRial,int OfferVersion);
public sealed record Quote(Guid Id,Guid BuyerId,Guid SellerId,Guid AddressId,string PurchaseType,
    string FulfillmentMode,List<QuoteItem> Items,List<CartItem> Unavailable,long ItemsTotalRial,
    DateTimeOffset ExpiresAtUtc,bool Used);
public sealed record OrderItem(Guid Id,Guid OfferId,Guid ProductId,int Quantity,long UnitPriceRial,long CashRial,long CreditRial,int RefundedQuantity);
public sealed record Order(Guid Id,Guid BuyerId,Guid SellerId,string PurchaseType,string FulfillmentMode,
    BuyerAddress Address,List<OrderItem> Items,long TotalRial,long CashPaidRial,long CreditPaidRial,
    Guid? CreditGrantId,string State,string RefundState,int Version,DateTimeOffset CreatedAtUtc,
    DateTimeOffset? ReceivedAtUtc,DateTimeOffset? HandoffAtUtc);
public sealed record CashWallet(Guid AccountId,long BalanceRial);
public sealed record CreditGrant(Guid Id,Guid AccountId,Guid ProgramId,long GrantedRial,long AvailableRial,DateTimeOffset ExpiresAtUtc,List<Guid> CategoryIds);
public sealed record CreditProgram(Guid Id,string Name,string FundingReference,long FundedRial,long UnallocatedRial,DateTimeOffset ExpiresAtUtc,List<Guid> CategoryIds,Guid? OrganizationId=null);
public sealed record Incident(Guid Id,Guid OrderId,Guid OrderItemId,Guid BuyerId,Guid SellerId,string Type,int Quantity,string EvidenceReference,
    string State,DateTimeOffset ReportedAtUtc,DateTimeOffset? ApprovedAtUtc,DateTimeOffset? ReturnDueAtUtc,
    DateTimeOffset? FirstContactAtUtc,DateTimeOffset? DoorVisitAtUtc,DateTimeOffset? CollectedAtUtc,bool PenaltyApplied,long RefundRial);
public sealed record Settlement(Guid Id,Guid OrderId,Guid SellerId,long GrossRial,long RefundRial,long PenaltyRial,long FixedFeeRial,string FeeVersion,long NetRial,string State,DateTimeOffset CreatedAtUtc);
public sealed record FeePolicy(Guid Id,string Version,long FixedInvoiceFeeRial,string ApprovalReference);
public sealed record Withdrawal(Guid Id,Guid BuyerId,long AmountRial,string IbanVerificationRequestReference,string State,DateTimeOffset RequestedAtUtc,DateTimeOffset DueAtUtc);
public sealed record SupportTicket(Guid Id,Guid AccountId,string Subject,string Message,string State,DateTimeOffset CreatedAtUtc,string? Reply);
public sealed class CommerceConflict(string code) : Exception(code);
public sealed class CommerceForbidden : Exception;
public sealed class CommerceMissing : Exception;
public sealed record CommerceNotification(Guid Id,Guid AccountId,string Code,Guid ResourceId,DateTimeOffset CreatedAtUtc,bool Read);
public sealed record CommerceContent(Guid Id,string Slug,string Title,string Text,bool Published,int Version);
public sealed record CommerceOrganization(Guid Id,string Name,string RegistrationReference);
public sealed record OrganizationMembership(Guid Id,Guid OrganizationId,Guid AccountId,string Role);
public sealed record CommerceStaffPermission(Guid Id,Guid AccountId,string Permission,bool Active);
