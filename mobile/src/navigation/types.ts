export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  AddAction: undefined;
  Vendors: undefined;
  Sites: undefined;
};

export type AuthedStackParamList = {
  HomeTabs: undefined;
  Settings: undefined;
  VendorDetails: { id: string };
  AddEntry: undefined;
  EditEntry: { id: string };
  Payment: { id: string };
};
