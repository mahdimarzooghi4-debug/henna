export const adminOperationId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) &&
  value !== "00000000-0000-0000-0000-000000000000";

type Row = Record<string, unknown>;
const row = (value: unknown): Row | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Row : null;
const int = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER):
  value is number => typeof value === "number" &&
  Number.isSafeInteger(value) && value >= min && value <= max;
const signedInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 &&
  value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const utc = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 50 &&
  Number.isFinite(Date.parse(value));

export type AdminSummary = {
  orders: number;
  cancelled: number;
  collected: number;
  openIncidents: number;
  preparedSettlements: number;
  grossRial: number;
};
export type AdminAudit = {
  id: string;
  actorId: string;
  commandId: string;
  resourceId: string;
  event: string;
  createdAtUtc: string;
};
export type AdminPermission = {
  id: string;
  accountId: string;
  permission: "FINANCE" | "SUPPORT";
  active: boolean;
};
export type AdminContent = {
  id: string;
  slug: string;
  title: string;
  text: string;
  published: boolean;
  version: number;
};
export type AdminOrganization = {
  id: string;
  name: string;
  registrationReference: string;
};
export type AdminMembership = {
  id: string;
  organizationId: string;
  accountId: string;
  role: "MANAGER" | "BENEFICIARY";
};
export type AdminFeePolicy = {
  id: string;
  version: string;
  fixedInvoiceFeeRial: number;
  approvalReference: string;
};
export type AdminWithdrawal = {
  id: string;
  buyerId: string;
  amountRial: number;
  ibanVerificationRequestReference: string;
  state: string;
  requestedAtUtc: string;
  dueAtUtc: string;
  slaEscalated: boolean;
};
export type AdminSettlement = {
  id: string;
  orderId: string;
  sellerId: string;
  grossRial: number;
  refundRial: number;
  penaltyRial: number;
  fixedFeeRial: number;
  feeVersion: string;
  netRial: number;
  state: string;
  createdAtUtc: string;
};

export type AdminProgram = {
  id: string;
  name: string;
  fundedRial: number;
  unallocatedRial: number;
  expiresAtUtc: string;
  categoryIds: string[];
  organizationId: string | null;
};
export type AdminCredit = {
  id: string;
  accountId: string;
  programId: string;
  grantedRial: number;
  availableRial: number;
  expiresAtUtc: string;
  categoryIds: string[];
  householdKey: string | null;
};
export type AdminHousehold = {
  id: string;
  accountId: string;
  householdKey: string;
  evidenceReference: string;
};
export type AdminAllocation = {
  grants: AdminCredit[];
  unallocatedRial: number;
  formulaVersion: string;
};

export function parseAdminSummary(value: unknown): AdminSummary | null {
  const x = row(value);
  if (!x || !int(x.orders) || !int(x.cancelled) || !int(x.collected) ||
      !int(x.openIncidents) || !int(x.preparedSettlements) ||
      !int(x.grossRial) || x.cancelled > x.orders ||
      x.collected > x.orders) return null;
  return {
    orders: x.orders, cancelled: x.cancelled, collected: x.collected,
    openIncidents: x.openIncidents,
    preparedSettlements: x.preparedSettlements,
    grossRial: x.grossRial,
  };
}

const parseAudit = (value: unknown): AdminAudit | null => {
  const x = row(value);
  return x && adminOperationId(x.Id) && adminOperationId(x.ActorId) &&
    adminOperationId(x.CommandId) && adminOperationId(x.ResourceId) &&
    text(x.Event, 120) && utc(x.CreatedAtUtc)
    ? { id:x.Id, actorId:x.ActorId, commandId:x.CommandId,
      resourceId:x.ResourceId, event:x.Event, createdAtUtc:x.CreatedAtUtc }
    : null;
};
const parsePermission = (value: unknown): AdminPermission | null => {
  const x = row(value);
  return x && adminOperationId(x.Id) && adminOperationId(x.AccountId) &&
    ["FINANCE","SUPPORT"].includes(String(x.Permission)) &&
    typeof x.Active === "boolean"
    ? { id:x.Id, accountId:x.AccountId,
      permission:x.Permission as AdminPermission["permission"],
      active:x.Active } : null;
};
const parseContent = (value: unknown): AdminContent | null => {
  const x = row(value);
  return x && adminOperationId(x.Id) && text(x.Slug,100) &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.Slug) &&
    text(x.Title,200) && text(x.Text,10000) &&
    typeof x.Published === "boolean" && int(x.Version,0,2147483647)
    ? { id:x.Id, slug:x.Slug, title:x.Title, text:x.Text,
      published:x.Published, version:x.Version } : null;
};
const parseOrganization = (value: unknown): AdminOrganization | null => {
  const x = row(value);
  return x && adminOperationId(x.Id) && text(x.Name,200) &&
    text(x.RegistrationReference,1000)
    ? { id:x.Id, name:x.Name, registrationReference:x.RegistrationReference }
    : null;
};
const parseMembership = (value: unknown): AdminMembership | null => {
  const x = row(value);
  return x && adminOperationId(x.Id) &&
    adminOperationId(x.OrganizationId) && adminOperationId(x.AccountId) &&
    ["MANAGER","BENEFICIARY"].includes(String(x.Role))
    ? { id:x.Id, organizationId:x.OrganizationId, accountId:x.AccountId,
      role:x.Role as AdminMembership["role"] } : null;
};
const parseFee = (value: unknown): AdminFeePolicy | null => {
  const x = row(value);
  return x && adminOperationId(x.Id) && text(x.Version,120) &&
    int(x.FixedInvoiceFeeRial) && text(x.ApprovalReference,1000)
    ? { id:x.Id, version:x.Version,
      fixedInvoiceFeeRial:x.FixedInvoiceFeeRial,
      approvalReference:x.ApprovalReference } : null;
};
const parseWithdrawal = (value: unknown): AdminWithdrawal | null => {
  const x = row(value);
  return x && adminOperationId(x.Id) && adminOperationId(x.BuyerId) &&
    int(x.AmountRial,1) && text(x.IbanVerificationRequestReference,1000) &&
    text(x.State,80) && utc(x.RequestedAtUtc) && utc(x.DueAtUtc) &&
    typeof x.SlaEscalated === "boolean"
    ? { id:x.Id, buyerId:x.BuyerId, amountRial:x.AmountRial,
      ibanVerificationRequestReference:x.IbanVerificationRequestReference,
      state:x.State, requestedAtUtc:x.RequestedAtUtc,
      dueAtUtc:x.DueAtUtc, slaEscalated:x.SlaEscalated } : null;
};
const parseSettlement = (value: unknown): AdminSettlement | null => {
  const x = row(value);
  return x && adminOperationId(x.Id) && adminOperationId(x.OrderId) &&
    adminOperationId(x.SellerId) && int(x.GrossRial) &&
    int(x.RefundRial) && int(x.PenaltyRial) && int(x.FixedFeeRial) &&
    text(x.FeeVersion,120) && signedInt(x.NetRial) && text(x.State,80) &&
    utc(x.CreatedAtUtc)
    ? { id:x.Id, orderId:x.OrderId, sellerId:x.SellerId,
      grossRial:x.GrossRial, refundRial:x.RefundRial,
      penaltyRial:x.PenaltyRial, fixedFeeRial:x.FixedFeeRial,
      feeVersion:x.FeeVersion, netRial:x.NetRial,
      state:x.State, createdAtUtc:x.CreatedAtUtc } : null;
};

const ids = (value: unknown, max: number): string[] | null => {
  if (!Array.isArray(value) || value.length > max) return null;
  const result:string[]=[];
  for (const item of value) {
    if (!adminOperationId(item)) return null;
    result.push(item);
  }
  return result;
};
const parseProgram = (value: unknown): AdminProgram | null => {
  const x=row(value), categoryIds=ids(x?.CategoryIds,100);
  const organizationId=x?.OrganizationId;
  return x && adminOperationId(x.Id) && text(x.Name,120) &&
    int(x.FundedRial,1) && int(x.UnallocatedRial) && x.UnallocatedRial<=x.FundedRial &&
    utc(x.ExpiresAtUtc) && categoryIds && categoryIds.length>0 &&
    (organizationId===null || adminOperationId(organizationId))
    ? {id:x.Id,name:x.Name,fundedRial:x.FundedRial,
      unallocatedRial:x.UnallocatedRial,expiresAtUtc:x.ExpiresAtUtc,
      categoryIds,organizationId:organizationId as string|null}:null;
};
const parseCredit = (value: unknown): AdminCredit | null => {
  const x=row(value), categoryIds=ids(x?.CategoryIds,100);
  const householdKey=x?.HouseholdKey;
  return x && adminOperationId(x.Id) && adminOperationId(x.AccountId) &&
    adminOperationId(x.ProgramId) && int(x.GrantedRial,1) &&
    int(x.AvailableRial) && x.AvailableRial<=x.GrantedRial &&
    utc(x.ExpiresAtUtc) && categoryIds &&
    (householdKey===null || adminOperationId(householdKey))
    ? {id:x.Id,accountId:x.AccountId,programId:x.ProgramId,
      grantedRial:x.GrantedRial,availableRial:x.AvailableRial,
      expiresAtUtc:x.ExpiresAtUtc,categoryIds,
      householdKey:householdKey as string|null}:null;
};
const parseHousehold = (value: unknown): AdminHousehold | null => {
  const x=row(value);
  return x && adminOperationId(x.Id) && adminOperationId(x.AccountId) &&
    adminOperationId(x.HouseholdKey) && text(x.EvidenceReference,1000)
    ? {id:x.Id,accountId:x.AccountId,householdKey:x.HouseholdKey,
      evidenceReference:x.EvidenceReference}:null;
};

const parsers = {
  audit: parseAudit,
  permissions: parsePermission,
  content: parseContent,
  organizations: parseOrganization,
  memberships: parseMembership,
  "fee-policies": parseFee,
  withdrawals: parseWithdrawal,
  settlements: parseSettlement,
  programs: parseProgram,
  credits: parseCredit,
  households: parseHousehold,
} as const;

export type AdminResourceKind = keyof typeof parsers;
export function parseAdminResourcePage(
  kind: AdminResourceKind,
  value: unknown,
  expectedPage: number,
): unknown[] | null {
  const x = row(value);
  if (!x || x.page !== expectedPage ||
      !(x.pageSize === 20 || (kind === "audit" && x.pageSize === undefined)) ||
      !Array.isArray(x.items) || x.items.length > 20) return null;
  const result: unknown[] = [];
  for (const item of x.items) {
    const parsed = parsers[kind](item as never);
    if (!parsed) return null;
    result.push(parsed);
  }
  return result;
}


export function parseAdminCommandResponse(
  action:string,
  value:unknown,
): unknown | null {
  if(action==="SET_STAFF_PERMISSION") return parsePermission(value);
  if(action==="CREATE_PROGRAM") return parseProgram(value);
  if(action==="LINK_HOUSEHOLD") return parseHousehold(value);
  if(action==="ALLOCATE_CREDIT"){
    const x=row(value);
    if(!x || !Array.isArray(x.grants) || x.grants.length>500 ||
        !int(x.unallocatedRial) || !text(x.formulaVersion,120)) return null;
    const grants:AdminCredit[]=[];
    for(const raw of x.grants){
      const grant=parseCredit(raw);
      if(!grant)return null;
      grants.push(grant);
    }
    return {grants,unallocatedRial:x.unallocatedRial,
      formulaVersion:x.formulaVersion} satisfies AdminAllocation;
  }
  if(action==="SAVE_CONTENT"||action==="PUBLISH_CONTENT") return parseContent(value);
  if(action==="CREATE_ORGANIZATION") return parseOrganization(value);
  if(action==="GRANT_ORGANIZATION_MEMBER"||action==="REVOKE_ORGANIZATION_MEMBER")
    return parseMembership(value);
  if(action==="SET_FEE_POLICY") return parseFee(value);
  if(action==="BUILD_SETTLEMENTS") {
    if(!Array.isArray(value)||value.length>500) return null;
    const rows:AdminSettlement[]=[];
    for(const item of value){
      const parsed=parseSettlement(item);
      if(!parsed)return null;
      rows.push(parsed);
    }
    return rows;
  }
  if(action==="ASSESS_WITHDRAWAL_SLA"){
    const x=row(value);
    return x&&int(x.escalated)?{escalated:x.escalated}:null;
  }
  return null;
}

export type AdminOperationIntent = { action:string; body:string; key:string };
export function adminOperationIntent(
  previous: AdminOperationIntent | null,
  action: string,
  input: unknown,
): AdminOperationIntent {
  const body=JSON.stringify(input);
  return previous?.action===action && previous.body===body
    ? previous : { action, body, key: crypto.randomUUID() };
}

export const adminRial = (value:number) =>
  new Intl.NumberFormat("fa-IR").format(value) + " ریال";
export const adminTime = (value:string) =>
  new Intl.DateTimeFormat("fa-IR", {
    dateStyle:"medium", timeStyle:"short",
  }).format(new Date(value));
