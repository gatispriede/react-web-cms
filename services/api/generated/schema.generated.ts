/**
 * GQty AUTO-GENERATED CODE: PLEASE DO NOT MODIFY MANUALLY
 */

import { type ScalarsEnumsHash } from "gqty";

export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  JSON: { input: any; output: any };
}

export interface InAddress {
  city: Scalars["String"]["input"];
  country: Scalars["String"]["input"];
  id?: InputMaybe<Scalars["String"]["input"]>;
  isDefault?: InputMaybe<Scalars["Boolean"]["input"]>;
  line1: Scalars["String"]["input"];
  line2?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  postalCode: Scalars["String"]["input"];
}

export interface InImage {
  created: Scalars["String"]["input"];
  id: Scalars["String"]["input"];
  location: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  size: Scalars["Int"]["input"];
  tags?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  type: Scalars["String"]["input"];
}

export interface InItem {
  action?: InputMaybe<Scalars["String"]["input"]>;
  actionContent?: InputMaybe<Scalars["String"]["input"]>;
  actionStyle?: InputMaybe<Scalars["String"]["input"]>;
  actionType?: InputMaybe<Scalars["String"]["input"]>;
  animation?: InputMaybe<Scalars["String"]["input"]>;
  content: Scalars["String"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
  style: Scalars["String"]["input"];
  type: Scalars["String"]["input"];
}

export interface InLanguage {
  default?: InputMaybe<Scalars["Boolean"]["input"]>;
  flag?: InputMaybe<Scalars["String"]["input"]>;
  label: Scalars["String"]["input"];
  symbol: Scalars["String"]["input"];
}

export interface InLogo {
  content: Scalars["String"]["input"];
}

export interface InNavigation {
  id: Scalars["String"]["input"];
  page: Scalars["String"]["input"];
  parent?: InputMaybe<Scalars["String"]["input"]>;
  sections: Array<InputMaybe<Scalars["String"]["input"]>>;
  seo?: InputMaybe<InSeo>;
  /**
   * Slug — F1 sub-pages follow-up. JSON scalar: a bare string is the
   * legacy single-locale form; an object `{en: "about", lv: "par-mums"}`
   * carries one slug per active locale.
   */
  slug?: InputMaybe<Scalars["JSON"]["input"]>;
  type: Scalars["String"]["input"];
}

export interface InSection {
  content?: InputMaybe<Array<InputMaybe<InItem>>>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  overlay?: InputMaybe<Scalars["Boolean"]["input"]>;
  overlayAnchor?: InputMaybe<Scalars["String"]["input"]>;
  page: Scalars["String"]["input"];
  slots?: InputMaybe<Array<InputMaybe<Scalars["Int"]["input"]>>>;
  /** Cross-cutting "transparent background" flag — clears the section's default bg chain. */
  transparent?: InputMaybe<Scalars["Boolean"]["input"]>;
  /** Section-level opacity, 0..100 (%). 0 / absent = opaque; 100 = invisible. */
  transparentOpacity?: InputMaybe<Scalars["Int"]["input"]>;
  type: Scalars["Int"]["input"];
}

export interface InSeo {
  author?: InputMaybe<Scalars["String"]["input"]>;
  charSet?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  image?: InputMaybe<Scalars["String"]["input"]>;
  image_alt?: InputMaybe<Scalars["String"]["input"]>;
  keywords?: InputMaybe<Array<InputMaybe<Scalars["String"]["input"]>>>;
  locale?: InputMaybe<Scalars["String"]["input"]>;
  modified_time?: InputMaybe<Scalars["String"]["input"]>;
  published_time?: InputMaybe<Scalars["String"]["input"]>;
  url?: InputMaybe<Scalars["String"]["input"]>;
  viewport?: InputMaybe<Scalars["String"]["input"]>;
}

export interface InUser {
  avatar?: InputMaybe<Scalars["String"]["input"]>;
  canPublishProduction?: InputMaybe<Scalars["Boolean"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  googleSub?: InputMaybe<Scalars["String"]["input"]>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  kind?: InputMaybe<Scalars["String"]["input"]>;
  mustChangePassword?: InputMaybe<Scalars["Boolean"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  password?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
  preferredAdminLocale?: InputMaybe<Scalars["String"]["input"]>;
  role?: InputMaybe<Scalars["String"]["input"]>;
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
  Boolean: true,
  Float: true,
  Int: true,
  JSON: true,
  String: true,
};
export const generatedSchema = {
  IAddress: {
    __typename: { __type: "String!" },
    city: { __type: "String!" },
    country: { __type: "String!" },
    id: { __type: "String!" },
    isDefault: { __type: "Boolean" },
    line1: { __type: "String!" },
    line2: { __type: "String" },
    name: { __type: "String!" },
    postalCode: { __type: "String!" },
  },
  ICustomer: {
    __typename: { __type: "String!" },
    createdAt: { __type: "String" },
    email: { __type: "String!" },
    emailVerified: { __type: "String" },
    id: { __type: "String!" },
    name: { __type: "String" },
    phone: { __type: "String" },
    shippingAddresses: { __type: "[IAddress!]!" },
  },
  IImage: {
    __typename: { __type: "String!" },
    created: { __type: "String!" },
    id: { __type: "String!" },
    location: { __type: "String!" },
    name: { __type: "String!" },
    size: { __type: "Int!" },
    tags: { __type: "[String]!" },
    type: { __type: "String!" },
  },
  IItem: {
    __typename: { __type: "String!" },
    action: { __type: "String" },
    actionContent: { __type: "String" },
    actionStyle: { __type: "String" },
    actionType: { __type: "String" },
    animation: { __type: "String" },
    content: { __type: "String!" },
    name: { __type: "String" },
    style: { __type: "String" },
    type: { __type: "String!" },
  },
  ILoadData: {
    __typename: { __type: "String!" },
    empty: { __type: "Boolean" },
    name: { __type: "String" },
    sizeOnDisk: { __type: "Float" },
  },
  ILogo: {
    __typename: { __type: "String!" },
    content: { __type: "String!" },
    editedAt: { __type: "String" },
    editedBy: { __type: "String" },
    id: { __type: "String" },
    type: { __type: "String" },
    version: { __type: "Int" },
  },
  INavigation: {
    __typename: { __type: "String!" },
    editedAt: { __type: "String" },
    editedBy: { __type: "String" },
    id: { __type: "String" },
    page: { __type: "String!" },
    parent: { __type: "String" },
    sections: { __type: "[String]!" },
    seo: { __type: "ISeo" },
    slug: { __type: "JSON" },
    type: { __type: "String!" },
  },
  INewLanguage: {
    __typename: { __type: "String!" },
    default: { __type: "Boolean" },
    editedAt: { __type: "String" },
    editedBy: { __type: "String" },
    flag: { __type: "String" },
    label: { __type: "String!" },
    symbol: { __type: "String!" },
    version: { __type: "Int" },
  },
  ISection: {
    __typename: { __type: "String!" },
    content: { __type: "[IItem]" },
    editedAt: { __type: "String" },
    editedBy: { __type: "String" },
    id: { __type: "String" },
    overlay: { __type: "Boolean" },
    overlayAnchor: { __type: "String" },
    page: { __type: "String" },
    slots: { __type: "[Int]" },
    transparent: { __type: "Boolean" },
    transparentOpacity: { __type: "Int" },
    type: { __type: "Int!" },
    version: { __type: "Int" },
  },
  ISeo: {
    __typename: { __type: "String!" },
    author: { __type: "String" },
    charSet: { __type: "String" },
    description: { __type: "String" },
    image: { __type: "String" },
    image_alt: { __type: "String" },
    keywords: { __type: "[String]" },
    locale: { __type: "String" },
    modified_time: { __type: "String" },
    published_time: { __type: "String" },
    url: { __type: "String" },
    viewport: { __type: "String" },
  },
  IUser: {
    __typename: { __type: "String!" },
    avatar: { __type: "String" },
    canPublishProduction: { __type: "Boolean" },
    email: { __type: "String!" },
    id: { __type: "String!" },
    kind: { __type: "String" },
    mustChangePassword: { __type: "Boolean" },
    name: { __type: "String" },
    password: { __type: "String!" },
    preferredAdminLocale: { __type: "String" },
    role: { __type: "String" },
  },
  InAddress: {
    city: { __type: "String!" },
    country: { __type: "String!" },
    id: { __type: "String" },
    isDefault: { __type: "Boolean" },
    line1: { __type: "String!" },
    line2: { __type: "String" },
    name: { __type: "String!" },
    postalCode: { __type: "String!" },
  },
  InImage: {
    created: { __type: "String!" },
    id: { __type: "String!" },
    location: { __type: "String!" },
    name: { __type: "String!" },
    size: { __type: "Int!" },
    tags: { __type: "[String]" },
    type: { __type: "String!" },
  },
  InItem: {
    action: { __type: "String" },
    actionContent: { __type: "String" },
    actionStyle: { __type: "String" },
    actionType: { __type: "String" },
    animation: { __type: "String" },
    content: { __type: "String!" },
    name: { __type: "String" },
    style: { __type: "String!" },
    type: { __type: "String!" },
  },
  InLanguage: {
    default: { __type: "Boolean" },
    flag: { __type: "String" },
    label: { __type: "String!" },
    symbol: { __type: "String!" },
  },
  InLogo: { content: { __type: "String!" } },
  InNavigation: {
    id: { __type: "String!" },
    page: { __type: "String!" },
    parent: { __type: "String" },
    sections: { __type: "[String]!" },
    seo: { __type: "InSeo" },
    slug: { __type: "JSON" },
    type: { __type: "String!" },
  },
  InSection: {
    content: { __type: "[InItem]" },
    id: { __type: "String" },
    overlay: { __type: "Boolean" },
    overlayAnchor: { __type: "String" },
    page: { __type: "String!" },
    slots: { __type: "[Int]" },
    transparent: { __type: "Boolean" },
    transparentOpacity: { __type: "Int" },
    type: { __type: "Int!" },
  },
  InSeo: {
    author: { __type: "String" },
    charSet: { __type: "String" },
    description: { __type: "String" },
    image: { __type: "String" },
    image_alt: { __type: "String" },
    keywords: { __type: "[String]" },
    locale: { __type: "String" },
    modified_time: { __type: "String" },
    published_time: { __type: "String" },
    url: { __type: "String" },
    viewport: { __type: "String" },
  },
  InUser: {
    avatar: { __type: "String" },
    canPublishProduction: { __type: "Boolean" },
    email: { __type: "String" },
    googleSub: { __type: "String" },
    id: { __type: "String" },
    kind: { __type: "String" },
    mustChangePassword: { __type: "Boolean" },
    name: { __type: "String" },
    password: { __type: "String" },
    phone: { __type: "String" },
    preferredAdminLocale: { __type: "String" },
    role: { __type: "String" },
  },
  MutationMongo: {
    __typename: { __type: "String!" },
    _empty: { __type: "String" },
    addUpdateLanguage: {
      __type: "String!",
      __args: {
        expectedVersion: "Int",
        language: "InLanguage",
        translations: "JSON",
      },
    },
    addUpdateNavigationItem: {
      __type: "String!",
      __args: { pageName: "String!", sections: "[String]" },
    },
    addUpdateSectionItem: {
      __type: "String!",
      __args: {
        expectedVersion: "Int",
        pageName: "String",
        section: "InSection!",
      },
    },
    addUser: { __type: "String!", __args: { user: "InUser!" } },
    analyticsFiltersUpdate: { __type: "String!", __args: { input: "JSON!" } },
    attachMarketingSession: { __type: "String!", __args: { input: "JSON!" } },
    backupNow: { __type: "String!", __args: { label: "String" } },
    backupRestoreToStaging: {
      __type: "String!",
      __args: { snapshotId: "String!" },
    },
    backupVerify: { __type: "String!" },
    changeMyPassword: {
      __type: "String!",
      __args: { newPassword: "String!", oldPassword: "String!" },
    },
    clearFeatureFlag: { __type: "String!", __args: { id: "String!" } },
    createNavigation: {
      __type: "String!",
      __args: { navigation: "InNavigation!" },
    },
    deleteImage: { __type: "String!", __args: { id: "String!" } },
    deleteLanguage: {
      __type: "String!",
      __args: { idempotencyKey: "String", language: "InLanguage" },
    },
    deleteMyAddress: { __type: "String!", __args: { id: "String!" } },
    deleteNavigationItem: {
      __type: "String!",
      __args: { idempotencyKey: "String", pageName: "String!" },
    },
    deletePost: {
      __type: "String!",
      __args: { id: "String!", idempotencyKey: "String" },
    },
    deleteTheme: {
      __type: "String!",
      __args: { id: "String!", idempotencyKey: "String" },
    },
    grantPermission: {
      __type: "String!",
      __args: { resourceId: "String!", scope: "String!", userId: "String!" },
    },
    markInboxNotificationRead: { __type: "String!", __args: { id: "String!" } },
    mcpIssueToken: {
      __type: "String!",
      __args: { name: "String!", scopes: "[String!]!", ttlDays: "Int" },
    },
    mcpRevokeToken: { __type: "String!", __args: { id: "String!" } },
    onboardingBootstrap: {
      __type: "String!",
      __args: {
        adminEmail: "String!",
        adminPassword: "String!",
        locale: "String!",
        siteName: "String!",
        themeKey: "String",
      },
    },
    publishSnapshot: { __type: "String!", __args: { note: "String" } },
    recordMarketingHit: { __type: "String!", __args: { input: "JSON!" } },
    removeSectionItem: {
      __type: "String!",
      __args: { id: "String!", idempotencyKey: "String" },
    },
    removeUser: {
      __type: "String!",
      __args: { id: "String!", idempotencyKey: "String" },
    },
    replaceUpdateNavigation: {
      __type: "String!",
      __args: { navigation: "InNavigation", oldPageName: "String!" },
    },
    requestServerRestart: { __type: "String!" },
    resetPreset: { __type: "String!", __args: { id: "String!" } },
    restoreFromTrash: { __type: "String!", __args: { trashGroup: "String!" } },
    revokePermission: {
      __type: "String!",
      __args: {
        idempotencyKey: "String",
        resourceId: "String!",
        scope: "String!",
        userId: "String!",
      },
    },
    rollbackToSnapshot: { __type: "String!", __args: { id: "String!" } },
    saveFooter: {
      __type: "String!",
      __args: { config: "JSON!", expectedVersion: "Int" },
    },
    saveImage: { __type: "String!", __args: { image: "InImage!" } },
    saveLogo: {
      __type: "String!",
      __args: { content: "String!", expectedVersion: "Int" },
    },
    saveMyAddress: { __type: "String!", __args: { address: "InAddress!" } },
    savePost: {
      __type: "String!",
      __args: { expectedVersion: "Int", post: "JSON!" },
    },
    saveSiteFlags: {
      __type: "String!",
      __args: { expectedVersion: "Int", flags: "JSON!" },
    },
    saveSiteSeo: {
      __type: "String!",
      __args: { expectedVersion: "Int", seo: "JSON!" },
    },
    saveTheme: {
      __type: "String!",
      __args: { expectedVersion: "Int", theme: "JSON!" },
    },
    saveTranslationMeta: {
      __type: "String!",
      __args: { expectedVersion: "Int", meta: "JSON!" },
    },
    setActiveTheme: { __type: "String!", __args: { id: "String!" } },
    setFeatureFlag: {
      __type: "String!",
      __args: { enabled: "Boolean!", id: "String!" },
    },
    setMyAdminUiMode: { __type: "String!", __args: { mode: "String!" } },
    setMyNotificationPreferences: {
      __type: "String!",
      __args: { prefs: "JSON!" },
    },
    setParent: {
      __type: "String!",
      __args: { pageId: "String!", parentId: "String" },
    },
    setPostPublished: {
      __type: "String!",
      __args: { id: "String!", publish: "Boolean!" },
    },
    signUpCustomer: { __type: "String!", __args: { customer: "InUser!" } },
    trackEvent: { __type: "String!", __args: { events: "[JSON!]!" } },
    updateMyProfile: { __type: "String!", __args: { customer: "InUser!" } },
    updateNavigation: {
      __type: "String!",
      __args: { page: "String!", sections: "[String]" },
    },
    updateUser: { __type: "String!", __args: { user: "InUser!" } },
  },
  QueryMongo: {
    __typename: { __type: "String!" },
    _empty: { __type: "String" },
    analyticsFiltersGet: { __type: "String!" },
    analyticsSummary: {
      __type: "String!",
      __args: { audience: "String", range: "String" },
    },
    backupListSnapshots: { __type: "String!" },
    backupStatus: { __type: "String!" },
    functionalRoles: { __type: "String!" },
    getActiveTheme: { __type: "String" },
    getAuditActors: { __type: "String!" },
    getAuditCollections: { __type: "String!" },
    getAuditLog: { __type: "String!", __args: { filter: "JSON" } },
    getDiagnostics: { __type: "String!" },
    getErrorLog: {
      __type: "String!",
      __args: {
        level: "String",
        limit: "Int",
        scope: "String",
        sinceISO: "String",
        source: "String",
      },
    },
    getFeatureFlags: { __type: "String!" },
    getFooter: { __type: "String!" },
    getImages: { __type: "[IImage!]!", __args: { tags: "String!" } },
    getLanguages: { __type: "[INewLanguage]" },
    getLogo: { __type: "ILogo" },
    getMongoDBUri: { __type: "String" },
    getNavigationCollection: { __type: "[INavigation!]!" },
    getPost: {
      __type: "String",
      __args: { includeDrafts: "Boolean", slug: "String!" },
    },
    getPosts: {
      __type: "String!",
      __args: { includeDrafts: "Boolean", limit: "Int" },
    },
    getPublishedHistory: { __type: "String!", __args: { limit: "Int" } },
    getPublishedMeta: { __type: "String" },
    getPublishedSnapshot: { __type: "String" },
    getRestartStatus: { __type: "String!" },
    getSections: { __type: "[ISection!]!", __args: { ids: "[String]" } },
    getSiteFlags: { __type: "String!" },
    getSiteSeo: { __type: "String!" },
    getThemes: { __type: "String!" },
    getTranslationMeta: { __type: "String!" },
    getTrashGroups: { __type: "String!" },
    getUser: { __type: "IUser", __args: { email: "String" } },
    getUsers: { __type: "[IUser!]!" },
    isFreshInstall: { __type: "Boolean!" },
    loadData: { __type: "[ILoadData!]!" },
    marketingAttributionReport: {
      __type: "String!",
      __args: { groupBy: "String", range: "String" },
    },
    mcpListTokens: { __type: "String!" },
    me: { __type: "ICustomer" },
    myAdminUiMode: { __type: "String!" },
    myInbox: {
      __type: "String!",
      __args: { limit: "Int", unreadOnly: "Boolean" },
    },
    myInboxUnreadCount: { __type: "Int!" },
    myNotificationPreferences: { __type: "String!" },
    notificationStats: { __type: "String!" },
    permissionsForUser: { __type: "String!", __args: { userId: "String!" } },
    setupAdmin: { __type: "IUser" },
  },
  mutation: {
    __typename: { __type: "String!" },
    mongo: { __type: "MutationMongo!" },
  },
  query: {
    __typename: { __type: "String!" },
    bar: { __type: "String!" },
    greeting: { __type: "String!" },
    mongo: { __type: "QueryMongo!" },
    sample: { __type: "String!" },
  },
  subscription: {},
} as const;

export interface IAddress {
  __typename?: "IAddress";
  city?: Scalars["String"]["output"];
  country?: Scalars["String"]["output"];
  id?: Scalars["String"]["output"];
  isDefault?: Maybe<Scalars["Boolean"]["output"]>;
  line1?: Scalars["String"]["output"];
  line2?: Maybe<Scalars["String"]["output"]>;
  name?: Scalars["String"]["output"];
  postalCode?: Scalars["String"]["output"];
}

export interface ICustomer {
  __typename?: "ICustomer";
  createdAt?: Maybe<Scalars["String"]["output"]>;
  email?: Scalars["String"]["output"];
  emailVerified?: Maybe<Scalars["String"]["output"]>;
  id?: Scalars["String"]["output"];
  name?: Maybe<Scalars["String"]["output"]>;
  phone?: Maybe<Scalars["String"]["output"]>;
  shippingAddresses: Array<IAddress>;
}

export interface IImage {
  __typename?: "IImage";
  created?: Scalars["String"]["output"];
  id?: Scalars["String"]["output"];
  location?: Scalars["String"]["output"];
  name?: Scalars["String"]["output"];
  size?: Scalars["Int"]["output"];
  tags?: Array<Maybe<Scalars["String"]["output"]>>;
  type?: Scalars["String"]["output"];
}

export interface IItem {
  __typename?: "IItem";
  action?: Maybe<Scalars["String"]["output"]>;
  actionContent?: Maybe<Scalars["String"]["output"]>;
  actionStyle?: Maybe<Scalars["String"]["output"]>;
  actionType?: Maybe<Scalars["String"]["output"]>;
  animation?: Maybe<Scalars["String"]["output"]>;
  content?: Scalars["String"]["output"];
  name?: Maybe<Scalars["String"]["output"]>;
  style?: Maybe<Scalars["String"]["output"]>;
  type?: Scalars["String"]["output"];
}

export interface ILoadData {
  __typename?: "ILoadData";
  empty?: Maybe<Scalars["Boolean"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
  sizeOnDisk?: Maybe<Scalars["Float"]["output"]>;
}

export interface ILogo {
  __typename?: "ILogo";
  content?: Scalars["String"]["output"];
  editedAt?: Maybe<Scalars["String"]["output"]>;
  editedBy?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["String"]["output"]>;
  type?: Maybe<Scalars["String"]["output"]>;
  version?: Maybe<Scalars["Int"]["output"]>;
}

export interface INavigation {
  __typename?: "INavigation";
  editedAt?: Maybe<Scalars["String"]["output"]>;
  editedBy?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["String"]["output"]>;
  page?: Scalars["String"]["output"];
  parent?: Maybe<Scalars["String"]["output"]>;
  sections?: Array<Maybe<Scalars["String"]["output"]>>;
  seo?: Maybe<ISeo>;
  /**
   * Slug — F1 sub-pages follow-up. JSON scalar; bare string for the
   * legacy single-locale form, or `{<locale>: <slug>, …}` for the
   * per-locale shape.
   */
  slug?: Maybe<Scalars["JSON"]["output"]>;
  type?: Scalars["String"]["output"];
}

export interface INewLanguage {
  __typename?: "INewLanguage";
  default?: Maybe<Scalars["Boolean"]["output"]>;
  editedAt?: Maybe<Scalars["String"]["output"]>;
  editedBy?: Maybe<Scalars["String"]["output"]>;
  flag?: Maybe<Scalars["String"]["output"]>;
  label?: Scalars["String"]["output"];
  symbol?: Scalars["String"]["output"];
  version?: Maybe<Scalars["Int"]["output"]>;
}

export interface ISection {
  __typename?: "ISection";
  content?: Maybe<Array<Maybe<IItem>>>;
  editedAt?: Maybe<Scalars["String"]["output"]>;
  editedBy?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["String"]["output"]>;
  overlay?: Maybe<Scalars["Boolean"]["output"]>;
  overlayAnchor?: Maybe<Scalars["String"]["output"]>;
  page?: Maybe<Scalars["String"]["output"]>;
  slots?: Maybe<Array<Maybe<Scalars["Int"]["output"]>>>;
  /**
   * Cross-cutting transparent-background flag — see InSection.transparent.
   */
  transparent?: Maybe<Scalars["Boolean"]["output"]>;
  /**
   * Section opacity 0..100 (%). See InSection.transparentOpacity.
   */
  transparentOpacity?: Maybe<Scalars["Int"]["output"]>;
  type?: Scalars["Int"]["output"];
  /**
   * Optimistic-concurrency counter — see src/Server/conflict.ts.
   */
  version?: Maybe<Scalars["Int"]["output"]>;
}

export interface ISeo {
  __typename?: "ISeo";
  author?: Maybe<Scalars["String"]["output"]>;
  charSet?: Maybe<Scalars["String"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  image?: Maybe<Scalars["String"]["output"]>;
  image_alt?: Maybe<Scalars["String"]["output"]>;
  keywords?: Maybe<Array<Maybe<Scalars["String"]["output"]>>>;
  locale?: Maybe<Scalars["String"]["output"]>;
  modified_time?: Maybe<Scalars["String"]["output"]>;
  published_time?: Maybe<Scalars["String"]["output"]>;
  url?: Maybe<Scalars["String"]["output"]>;
  viewport?: Maybe<Scalars["String"]["output"]>;
}

export interface IUser {
  __typename?: "IUser";
  avatar?: Maybe<Scalars["String"]["output"]>;
  canPublishProduction?: Maybe<Scalars["Boolean"]["output"]>;
  email?: Scalars["String"]["output"];
  id?: Scalars["String"]["output"];
  kind?: Maybe<Scalars["String"]["output"]>;
  mustChangePassword?: Maybe<Scalars["Boolean"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
  password?: Scalars["String"]["output"];
  preferredAdminLocale?: Maybe<Scalars["String"]["output"]>;
  role?: Maybe<Scalars["String"]["output"]>;
}

export interface MutationMongo {
  __typename?: "MutationMongo";
  /**
   * Sentinel — see Phase C.3 note on `QueryMongo._empty`.
   */
  _empty?: Maybe<Scalars["String"]["output"]>;
  addUpdateLanguage: (args?: {
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
    language?: Maybe<InLanguage>;
    translations?: Maybe<Scalars["JSON"]["input"]>;
  }) => Scalars["String"]["output"];
  addUpdateNavigationItem: (args: {
    pageName: Scalars["String"]["input"];
    sections?: Maybe<Array<Maybe<Scalars["String"]["input"]>>>;
  }) => Scalars["String"]["output"];
  addUpdateSectionItem: (args: {
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
    pageName?: Maybe<Scalars["String"]["input"]>;
    section: InSection;
  }) => Scalars["String"]["output"];
  addUser: (args: { user: InUser }) => Scalars["String"]["output"];
  /**
   * Admin — replace the internal-IP allowlist + labels. `input` is a JSON object {internalIps: string[], labels?: {ip: label}}.
   */
  analyticsFiltersUpdate: (args: {
    input: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Public — bind an anonymous sessionId to the signed-in user id. Called on signup + magic-link redeem.
   */
  attachMarketingSession: (args: {
    input: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * W8e — trigger an immediate backup. Admin-only.
   */
  backupNow: (args?: {
    label?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  /**
   * W8e — restore a snapshot into a sandbox staging directory. Admin-only.
   */
  backupRestoreToStaging: (args: {
    snapshotId: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * W8e — run `restic check` against the latest snapshot. Admin-only.
   */
  backupVerify?: Scalars["String"]["output"];
  changeMyPassword: (args: {
    newPassword: Scalars["String"]["input"];
    oldPassword: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Drop a feature toggle override; the feature falls back to its default behaviour.
   */
  clearFeatureFlag: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  createNavigation: (args: {
    navigation: InNavigation;
  }) => Scalars["String"]["output"];
  deleteImage: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  deleteLanguage: (args?: {
    idempotencyKey?: Maybe<Scalars["String"]["input"]>;
    language?: Maybe<InLanguage>;
  }) => Scalars["String"]["output"];
  deleteMyAddress: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  deleteNavigationItem: (args: {
    idempotencyKey?: Maybe<Scalars["String"]["input"]>;
    pageName: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  deletePost: (args: {
    id: Scalars["String"]["input"];
    idempotencyKey?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  deleteTheme: (args: {
    id: Scalars["String"]["input"];
    idempotencyKey?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  /**
   * Admin — grant a (user, scope, resourceId) permission. Idempotent.
   */
  grantPermission: (args: {
    resourceId: Scalars["String"]["input"];
    scope: Scalars["String"]["input"];
    userId: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Mark an inbox row as read.
   */
  markInboxNotificationRead: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Admin-only — issue a new MCP token. Secret is returned ONCE in the response.
   */
  mcpIssueToken: (args: {
    name: Scalars["String"]["input"];
    scopes: Array<Scalars["String"]["input"]>;
    ttlDays?: Maybe<Scalars["Int"]["input"]>;
  }) => Scalars["String"]["output"];
  /**
   * Admin-only — revoke an MCP token by id.
   */
  mcpRevokeToken: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  onboardingBootstrap: (args: {
    adminEmail: Scalars["String"]["input"];
    adminPassword: Scalars["String"]["input"];
    locale: Scalars["String"]["input"];
    siteName: Scalars["String"]["input"];
    themeKey?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  publishSnapshot: (args?: {
    note?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  /**
   * Public — record one attribution hit. Body: sessionId, utm{}, ref, landingPath, referrer. Idempotent on identical hits.
   */
  recordMarketingHit: (args: {
    input: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  removeSectionItem: (args: {
    id: Scalars["String"]["input"];
    idempotencyKey?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  removeUser: (args: {
    id: Scalars["String"]["input"];
    idempotencyKey?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  replaceUpdateNavigation: (args: {
    navigation?: Maybe<InNavigation>;
    oldPageName: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Schedule a graceful server shutdown; supervisor respawns. Returns the current bootId so the caller can poll /api/health for the new process.
   */
  requestServerRestart?: Scalars["String"]["output"];
  resetPreset: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Admin — restore every doc tied to a trashGroup (within the 24h TTL window).
   */
  restoreFromTrash: (args: {
    trashGroup: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Admin — revoke a (user, scope, resourceId) permission.
   */
  revokePermission: (args: {
    idempotencyKey?: Maybe<Scalars["String"]["input"]>;
    resourceId: Scalars["String"]["input"];
    scope: Scalars["String"]["input"];
    userId: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  rollbackToSnapshot: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  saveFooter: (args: {
    config: Scalars["JSON"]["input"];
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
  }) => Scalars["String"]["output"];
  saveImage: (args: { image: InImage }) => Scalars["String"]["output"];
  saveLogo: (args: {
    content: Scalars["String"]["input"];
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
  }) => Scalars["String"]["output"];
  saveMyAddress: (args: { address: InAddress }) => Scalars["String"]["output"];
  savePost: (args: {
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
    post: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  saveSiteFlags: (args: {
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
    flags: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  saveSiteSeo: (args: {
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
    seo: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  saveTheme: (args: {
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
    theme: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  saveTranslationMeta: (args: {
    expectedVersion?: Maybe<Scalars["Int"]["input"]>;
    meta: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  setActiveTheme: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Persist a plug-and-play feature toggle override. Returns JSON {id, enabled, updatedAt, updatedBy}.
   */
  setFeatureFlag: (args: {
    enabled: Scalars["Boolean"]["input"];
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Editor or admin self-service — flip own admin UI mode.
   */
  setMyAdminUiMode: (args: {
    mode: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  /**
   * Patch the calling customer's notification preferences. Returns the merged blob.
   */
  setMyNotificationPreferences: (args: {
    prefs: Scalars["JSON"]["input"];
  }) => Scalars["String"]["output"];
  setParent: (args: {
    pageId: Scalars["String"]["input"];
    parentId?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  setPostPublished: (args: {
    id: Scalars["String"]["input"];
    publish: Scalars["Boolean"]["input"];
  }) => Scalars["String"]["output"];
  signUpCustomer: (args: { customer: InUser }) => Scalars["String"]["output"];
  /**
   * Public — accept a batch of client-side analytics events. Server validates + rate-limits per anonId; rejected rows silently dropped.
   */
  trackEvent: (args: {
    events: Array<Scalars["JSON"]["input"]>;
  }) => Scalars["String"]["output"];
  updateMyProfile: (args: { customer: InUser }) => Scalars["String"]["output"];
  updateNavigation: (args: {
    page: Scalars["String"]["input"];
    sections?: Maybe<Array<Maybe<Scalars["String"]["input"]>>>;
  }) => Scalars["String"]["output"];
  updateUser: (args: { user: InUser }) => Scalars["String"]["output"];
}

export interface QueryMongo {
  __typename?: "QueryMongo";
  /**
   * Sentinel — see Phase C.3 note above. All real fields arrive via manifest `extend type QueryMongo` fragments.
   */
  _empty?: Maybe<Scalars["String"]["output"]>;
  /**
   * Admin — current internal-IP allowlist + labels.
   */
  analyticsFiltersGet?: Scalars["String"]["output"];
  /**
   * Admin — analytics summary for the dashboard. `range`: 24h | 7d | 30d. `audience`: public (default) | admin | internal | bot | all.
   */
  analyticsSummary: (args?: {
    audience?: Maybe<Scalars["String"]["input"]>;
    range?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  /**
   * W8e — recent backup snapshots from the restic repo. Admin-only.
   */
  backupListSnapshots?: Scalars["String"]["output"];
  /**
   * W8e — latest backup status + last drill result. Admin-only.
   */
  backupStatus?: Scalars["String"]["output"];
  /**
   * Read — list of functional roles declared by every active feature, with assignable flag.
   */
  functionalRoles?: Scalars["String"]["output"];
  getActiveTheme?: Maybe<Scalars["String"]["output"]>;
  getAuditActors?: Scalars["String"]["output"];
  getAuditCollections?: Scalars["String"]["output"];
  getAuditLog: (args?: {
    filter?: Maybe<Scalars["JSON"]["input"]>;
  }) => Scalars["String"]["output"];
  /**
   * Operator-facing runtime snapshot — build identity, feature manifest summary, storage health, trash + idempotency counts, authorization scope counts. Admin-only.
   */
  getDiagnostics?: Scalars["String"]["output"];
  /**
   * Recent rows from the structured ErrorLog collection. Filters mirror MCP's audit.errors.
   */
  getErrorLog: (args?: {
    level?: Maybe<Scalars["String"]["input"]>;
    limit?: Maybe<Scalars["Int"]["input"]>;
    scope?: Maybe<Scalars["String"]["input"]>;
    sinceISO?: Maybe<Scalars["String"]["input"]>;
    source?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  /**
   * Plug-and-play feature flags — runtime view of which feature manifests are active.
   */
  getFeatureFlags?: Scalars["String"]["output"];
  getFooter?: Scalars["String"]["output"];
  getImages: (args: { tags: Scalars["String"]["input"] }) => Array<IImage>;
  getLanguages?: Maybe<Array<Maybe<INewLanguage>>>;
  getLogo?: Maybe<ILogo>;
  /**
   * Resolved MongoDB URI — admin-only, surfaces the active connection string for ops introspection.
   */
  getMongoDBUri?: Maybe<Scalars["String"]["output"]>;
  getNavigationCollection: Array<INavigation>;
  getPost: (args: {
    includeDrafts?: Maybe<Scalars["Boolean"]["input"]>;
    slug: Scalars["String"]["input"];
  }) => Maybe<Scalars["String"]["output"]>;
  getPosts: (args?: {
    includeDrafts?: Maybe<Scalars["Boolean"]["input"]>;
    limit?: Maybe<Scalars["Int"]["input"]>;
  }) => Scalars["String"]["output"];
  getPublishedHistory: (args?: {
    limit?: Maybe<Scalars["Int"]["input"]>;
  }) => Scalars["String"]["output"];
  getPublishedMeta?: Maybe<Scalars["String"]["output"]>;
  getPublishedSnapshot?: Maybe<Scalars["String"]["output"]>;
  /**
   * Restart status — current bootId, uptime, supervisor detection, pending restart reasons.
   */
  getRestartStatus?: Scalars["String"]["output"];
  getSections: (args?: {
    ids?: Maybe<Array<Maybe<Scalars["String"]["input"]>>>;
  }) => Array<ISection>;
  getSiteFlags?: Scalars["String"]["output"];
  getSiteSeo?: Scalars["String"]["output"];
  getThemes?: Scalars["String"]["output"];
  getTranslationMeta?: Scalars["String"]["output"];
  /**
   * Admin — list every soft-deleted cohort (one per trashGroup) with summary counts.
   */
  getTrashGroups?: Scalars["String"]["output"];
  getUser: (args?: {
    email?: Maybe<Scalars["String"]["input"]>;
  }) => Maybe<IUser>;
  getUsers: Array<IUser>;
  isFreshInstall?: Scalars["Boolean"]["output"];
  /**
   * Mongo `listDatabases` projection — sizing + names for the operator dashboard.
   */
  loadData: Array<ILoadData>;
  /**
   * Admin — aggregated attribution report. Args: groupBy (source|campaign|ref), range (7d|30d|all).
   */
  marketingAttributionReport: (args?: {
    groupBy?: Maybe<Scalars["String"]["input"]>;
    range?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  /**
   * Admin-only — list issued MCP tokens (no secrets returned).
   */
  mcpListTokens?: Scalars["String"]["output"];
  me?: Maybe<ICustomer>;
  /**
   * Resolved admin UI mode for the calling session. Per-user setting wins; falls back to siteFlags.defaultAdminUiMode then 'advanced'.
   */
  myAdminUiMode?: Scalars["String"]["output"];
  /**
   * Customer's inbox — most recent first.
   */
  myInbox: (args?: {
    limit?: Maybe<Scalars["Int"]["input"]>;
    unreadOnly?: Maybe<Scalars["Boolean"]["input"]>;
  }) => Scalars["String"]["output"];
  myInboxUnreadCount?: Scalars["Int"]["output"];
  /**
   * Customer's own notification preferences (with defaults merged).
   */
  myNotificationPreferences?: Scalars["String"]["output"];
  /**
   * Admin observability — per-category routing distribution + 24h inbox volume.
   */
  notificationStats?: Scalars["String"]["output"];
  /**
   * Admin — list every permission grant for a user.
   */
  permissionsForUser: (args: {
    userId: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  setupAdmin?: Maybe<IUser>;
}

export interface Mutation {
  __typename?: "Mutation";
  mongo: MutationMongo;
}

export interface Query {
  __typename?: "Query";
  bar?: Scalars["String"]["output"];
  greeting?: Scalars["String"]["output"];
  mongo: QueryMongo;
  sample?: Scalars["String"]["output"];
}

export interface Subscription {
  __typename?: "Subscription";
}

export interface GeneratedSchema {
  query: Query;
  mutation: Mutation;
  subscription: Subscription;
}
