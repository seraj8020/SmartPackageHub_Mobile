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
  ResidentTabs: undefined;
  DeliveryPreference: { pkg: HubPackage };
};

export type ResidentTabParamList = {
  Inbox: undefined;
  History: undefined;
  Vacation: undefined;
  Profile: undefined;
};

export type StaffTabParamList = {
  Scan: undefined;
  Inbox: undefined;
  Shelf: undefined;
  Map: undefined;
  Route: undefined;
  Hand: undefined;
  Done: undefined;
};
