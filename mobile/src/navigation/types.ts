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
  SiteDetails: { id: string };
  VendorDetails: { id: string };
  ScopedTransactions: {
    siteId: string;
    vendorId: string;
    siteName: string;
    vendorName: string;
  };
  AddEntry:
    | {
        vendorId?: string;
        siteId?: string;
        vendorName?: string;
        siteName?: string;
      }
    | undefined;
  EditEntry: { id: string };
  Payment: { id: string };
};
