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
  sections: Array<InputMaybe<Scalars["String"]["input"]>>;
  seo?: InputMaybe<InSeo>;
  type: Scalars["String"]["input"];
}

export interface InSection {
  content?: InputMaybe<Array<InputMaybe<InItem>>>;
  id?: InputMaybe<Scalars["String"]["input"]>;
  overlay?: InputMaybe<Scalars["Boolean"]["input"]>;
  overlayAnchor?: InputMaybe<Scalars["String"]["input"]>;
  page: Scalars["String"]["input"];
  slots?: InputMaybe<Array<InputMaybe<Scalars["Int"]["input"]>>>;
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
  id?: InputMaybe<Scalars["String"]["input"]>;
  mustChangePassword?: InputMaybe<Scalars["Boolean"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  password?: InputMaybe<Scalars["String"]["input"]>;
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
    sections: { __type: "[String]!" },
    seo: { __type: "ISeo" },
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
    mustChangePassword: { __type: "Boolean" },
    name: { __type: "String" },
    password: { __type: "String!" },
    preferredAdminLocale: { __type: "String" },
    role: { __type: "String" },
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
    sections: { __type: "[String]!" },
    seo: { __type: "InSeo" },
    type: { __type: "String!" },
  },
  InSection: {
    content: { __type: "[InItem]" },
    id: { __type: "String" },
    overlay: { __type: "Boolean" },
    overlayAnchor: { __type: "String" },
    page: { __type: "String!" },
    slots: { __type: "[Int]" },
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
    id: { __type: "String" },
    mustChangePassword: { __type: "Boolean" },
    name: { __type: "String" },
    password: { __type: "String" },
    preferredAdminLocale: { __type: "String" },
    role: { __type: "String" },
  },
  MutationMongo: {
    __typename: { __type: "String!" },
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
    createNavigation: {
      __type: "String!",
      __args: { navigation: "InNavigation!" },
    },
    deleteImage: { __type: "String!", __args: { id: "String!" } },
    deleteLanguage: { __type: "String!", __args: { language: "InLanguage" } },
    deleteNavigationItem: {
      __type: "String!",
      __args: { pageName: "String!" },
    },
    deletePost: { __type: "String!", __args: { id: "String!" } },
    deleteTheme: { __type: "String!", __args: { id: "String!" } },
    publishSnapshot: { __type: "String!", __args: { note: "String" } },
    removeSectionItem: { __type: "String!", __args: { id: "String!" } },
    removeUser: { __type: "String!", __args: { id: "String!" } },
    replaceUpdateNavigation: {
      __type: "String!",
      __args: { navigation: "InNavigation", oldPageName: "String!" },
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
    resetPreset: { __type: "String!", __args: { id: "String!" } },
    setPostPublished: {
      __type: "String!",
      __args: { id: "String!", publish: "Boolean!" },
    },
    updateNavigation: {
      __type: "String!",
      __args: { page: "String!", sections: "[String]" },
    },
    updateUser: { __type: "String!", __args: { user: "InUser!" } },
  },
  QueryMongo: {
    __typename: { __type: "String!" },
    getActiveTheme: { __type: "String" },
    getAuditActors: { __type: "String!" },
    getAuditCollections: { __type: "String!" },
    getAuditLog: { __type: "String!", __args: { filter: "JSON" } },
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
    getSections: { __type: "[ISection!]!", __args: { ids: "[String]" } },
    getSiteFlags: { __type: "String!" },
    getSiteSeo: { __type: "String!" },
    getThemes: { __type: "String!" },
    getTranslationMeta: { __type: "String!" },
    getUser: { __type: "IUser", __args: { email: "String" } },
    getUsers: { __type: "[IUser!]!" },
    loadData: { __type: "[ILoadData!]!" },
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
  sections?: Array<Maybe<Scalars["String"]["output"]>>;
  seo?: Maybe<ISeo>;
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
  mustChangePassword?: Maybe<Scalars["Boolean"]["output"]>;
  name?: Maybe<Scalars["String"]["output"]>;
  password?: Scalars["String"]["output"];
  preferredAdminLocale?: Maybe<Scalars["String"]["output"]>;
  role?: Maybe<Scalars["String"]["output"]>;
}

export interface MutationMongo {
  __typename?: "MutationMongo";
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
  createNavigation: (args: {
    navigation: InNavigation;
  }) => Scalars["String"]["output"];
  deleteImage: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  deleteLanguage: (args?: {
    language?: Maybe<InLanguage>;
  }) => Scalars["String"]["output"];
  deleteNavigationItem: (args: {
    pageName: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  deletePost: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  deleteTheme: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  publishSnapshot: (args?: {
    note?: Maybe<Scalars["String"]["input"]>;
  }) => Scalars["String"]["output"];
  removeSectionItem: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  removeUser: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  replaceUpdateNavigation: (args: {
    navigation?: Maybe<InNavigation>;
    oldPageName: Scalars["String"]["input"];
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
  resetPreset: (args: {
    id: Scalars["String"]["input"];
  }) => Scalars["String"]["output"];
  setPostPublished: (args: {
    id: Scalars["String"]["input"];
    publish: Scalars["Boolean"]["input"];
  }) => Scalars["String"]["output"];
  updateNavigation: (args: {
    page: Scalars["String"]["input"];
    sections?: Maybe<Array<Maybe<Scalars["String"]["input"]>>>;
  }) => Scalars["String"]["output"];
  updateUser: (args: { user: InUser }) => Scalars["String"]["output"];
}

export interface QueryMongo {
  __typename?: "QueryMongo";
  getActiveTheme?: Maybe<Scalars["String"]["output"]>;
  getAuditActors?: Scalars["String"]["output"];
  getAuditCollections?: Scalars["String"]["output"];
  getAuditLog: (args?: {
    filter?: Maybe<Scalars["JSON"]["input"]>;
  }) => Scalars["String"]["output"];
  getFooter?: Scalars["String"]["output"];
  getImages: (args: { tags: Scalars["String"]["input"] }) => Array<IImage>;
  getLanguages?: Maybe<Array<Maybe<INewLanguage>>>;
  getLogo?: Maybe<ILogo>;
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
  getSections: (args?: {
    ids?: Maybe<Array<Maybe<Scalars["String"]["input"]>>>;
  }) => Array<ISection>;
  getSiteFlags?: Scalars["String"]["output"];
  getSiteSeo?: Scalars["String"]["output"];
  getThemes?: Scalars["String"]["output"];
  getTranslationMeta?: Scalars["String"]["output"];
  getUser: (args?: {
    email?: Maybe<Scalars["String"]["input"]>;
  }) => Maybe<IUser>;
  getUsers: Array<IUser>;
  loadData: Array<ILoadData>;
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
