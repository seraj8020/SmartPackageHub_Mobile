import type { HubPackage } from "@/shared/services/packageApi";

export type RootStackParamList = {
  Launch: undefined;
  ResidentLogin: undefined;
  ResidentRegister: undefined;
  StaffLogin: undefined;
  ResidentApp: undefined;
  StaffApp: undefined;
};

export type ResidentStackParamList = {
  Home: undefined;
  Packages: undefined;
  History: undefined;
  Vacation: undefined;
  Profile: undefined;
  DeliveryPreference: { pkg: HubPackage };
  PackageDetail: { pkg: HubPackage };
};

/** @deprecated Use ResidentStackParamList — kept temporarily for any lingering imports. */
export type ResidentTabParamList = {
  Inbox: undefined;
  History: undefined;
  Vacation: undefined;
  Profile: undefined;
};

export type StaffStackParamList = {
  Home: undefined;
  Scan: undefined;
  Inbox: undefined;
  Shelf: undefined;
  Map: undefined;
  Route: undefined;
  Hand: undefined;
  Done: undefined;
};

/** @deprecated Use StaffStackParamList */
export type StaffTabParamList = StaffStackParamList;
