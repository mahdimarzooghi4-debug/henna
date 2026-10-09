import * as Location from "expo-location";
import {
  requestAddressCoordinates,
  type AddressLocationResult,
} from "./device-location.ts";

/**
 * Foreground-only and user-triggered. No background task, watch or reverse
 * geocoding is started by this helper.
 */
export function requestNativeAddressCoordinates():
  Promise<AddressLocationResult> {
  return requestAddressCoordinates({
    async requestForegroundPermission() {
      const result = await Location.requestForegroundPermissionsAsync();
      return result.status;
    },
    servicesEnabled: () => Location.hasServicesEnabledAsync(),
    async current() {
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
    },
  });
}
