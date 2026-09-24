export type OrganizationProfile = {
  organizationId: string;
  name: string;
  organizationType: string;
  defaultAllocationMethod: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  representativeName: string | null;
  representativePhone: string | null;
  verified: boolean;
  active: true;
  memberRole: string;
};

export type OrganizationProfileState =
  | { status: "ready"; profile: OrganizationProfile }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "unavailable" };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

function optionalString(value: unknown, max: number): value is string | null {
  return value === null || (typeof value === "string" &&
    value.length <= max && !/[\u0000-\u001f\u007f]/.test(value));
}

export function parseOrganizationProfile(
  value: unknown,
): OrganizationProfile | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const organizationId = data.organizationId;
  const name = data.name;
  const organizationType = data.organizationType;
  const defaultAllocationMethod = data.defaultAllocationMethod;
  const phone = data.phone;
  const email = data.email;
  const address = data.address;
  const representativeName = data.representativeName;
  const representativePhone = data.representativePhone;
  const verified = data.verified;
  const memberRole = data.memberRole;

  if (typeof organizationId !== "string" ||
    !uuidPattern.test(organizationId) ||
    !requiredString(name, 200) ||
    !requiredString(organizationType, 80) ||
    !requiredString(defaultAllocationMethod, 120) ||
    !optionalString(phone, 32) ||
    !optionalString(email, 254) ||
    !optionalString(address, 500) ||
    !optionalString(representativeName, 160) ||
    !optionalString(representativePhone, 32) ||
    typeof verified !== "boolean" ||
    data.active !== true ||
    !requiredString(memberRole, 64))
    return null;

  return {
    organizationId,
    name: name.trim(),
    organizationType: organizationType.trim(),
    defaultAllocationMethod: defaultAllocationMethod.trim(),
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    address: address?.trim() || null,
    representativeName: representativeName?.trim() || null,
    representativePhone: representativePhone?.trim() || null,
    verified,
    active: true,
    memberRole: memberRole.trim(),
  };
}
