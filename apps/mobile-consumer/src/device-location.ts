export type AddressCoordinates = {
  latitude: number;
  longitude: number;
};

export type AddressLocationResult =
  | { status: "ok"; coordinates: AddressCoordinates }
  | { status: "denied" }
  | { status: "disabled" }
  | { status: "unavailable" };

export interface AddressLocationProvider {
  requestForegroundPermission(): Promise<"granted" | "denied" | "undetermined">;
  servicesEnabled(): Promise<boolean>;
  current(): Promise<{ latitude: number; longitude: number }>;
}

const coordinate = (value: number, limit: number) =>
  Number.isFinite(value) && Math.abs(value) <= limit;

export async function requestAddressCoordinates(
  provider: AddressLocationProvider,
): Promise<AddressLocationResult> {
  try {
    const permission = await provider.requestForegroundPermission();
    if (permission !== "granted") return { status: "denied" };
    if (!await provider.servicesEnabled()) return { status: "disabled" };
    const value = await provider.current();
    if (!coordinate(value.latitude, 90) ||
        !coordinate(value.longitude, 180))
      return { status: "unavailable" };
    return {
      status: "ok",
      coordinates: {
        latitude: Number(value.latitude.toFixed(6)),
        longitude: Number(value.longitude.toFixed(6)),
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}
