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
  content: Scalars["String"]["input"];
  name?: InputMaybe<Scalars["String"]["input"]>;
  style: Scalars["String"]["input"];
  type: Scalars["String"]["input"];
}

export interface InLanguage {
  default?: InputMaybe<Scalars["Boolean"]["input"]>;
  label: Scalars["String"]["input"];
  symbol: Scalars["String"]["input"];
  flag?: InputMaybe<Scalars["String"]["input"]>;
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
  page: Scalars["String"]["input"];
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
    id: { __type: "String" },
    type: { __type: "String" },
    editedBy: { __type: "String" },
    editedAt: { __type: "String" },
  },
  INavigation: {
    __typename: { __type: "String!" },
    id: { __type: "String" },
    page: { __type: "String!" },
    sections: { __type: "[String]!" },
    seo: { __type: "ISeo" },
    type: { __type: "String!" },
    editedBy: { __type: "String" },
    editedAt: { __type: "String" },
  },
  INewLanguage: {
    __typename: { __type: "String!" },
    default: { __type: "Boolean" },
    label: { __type: "String!" },
    symbol: { __type: "String!" },
    flag: { __type: "String" },
    editedBy: { __type: "String" },
    editedAt: { __type: "String" },
  },
  ISection: {
    __typename: { __type: "String!" },
    content: { __type: "[IItem]" },
    id: { __type: "String" },
    page: { __type: "String" },
    type: { __type: "Int!" },
    slots: { __type: "[Int]" },
    overlay: { __type: "Boolean" },
    overlayAnchor: { __type: "String" },
    editedBy: { __type: "String" },
    editedAt: { __type: "String" },
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
    name: { __type: "String" },
    password: { __type: "String!" },
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
    content: { __type: "String!" },
    name: { __type: "String" },
    style: { __type: "String!" },
    type: { __type: "String!" },
  },
  InLanguage: {
    default: { __type: "Boolean" },
    label: { __type: "String!" },
    symbol: { __type: "String!" },
    flag: { __type: "String" },
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
    page: { __type: "String!" },
    type: { __type: "Int!" },
    slots: { __type: "[Int]" },
    overlay: { __type: "Boolean" },
    overlayAnchor: { __type: "String" },
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
    name: { __type: "String" },
    password: { __type: "String" },
    role: { __type: "String" },
  },
  MutationMongo: {
    __typename: { __type: "String!" },
    addUpdateLanguage: {
      __type: "String!",
      __args: { language: "InLanguage", translations: "JSON" },
    },
    addUser: { __type: "String!", __args: { user: "InUser!" } },
    updateUser: { __type: "String!", __args: { user: "InUser!" } },
    removeUser: { __type: "String!", __args: { id: "String!" } },
    addUpdateNavigationItem: {
      __type: "String!",
      __args: { pageName: "String!", sections: "[String]" },
    },
    addUpdateSectionItem: {
      __type: "String!",
      __args: { pageName: "String", section: "InSection!" },
    },
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
    removeSectionItem: { __type: "String!", __args: { id: "String!" } },
    replaceUpdateNavigation: {
      __type: "String!",
      __args: { navigation: "InNavigation", oldPageName: "String!" },
    },
    saveImage: { __type: "String!", __args: { image: "InImage!" } },
    saveLogo: { __type: "String!", __args: { content: "String!" } },
    updateNavigation: {
      __type: "String!",
      __args: { page: "String!", sections: "[String]" },
    },
    publishSnapshot: { __type: "String!", __args: { note: "String" } },
    rollbackToSnapshot: { __type: "String!", __args: { id: "String!" } },
    saveTheme: { __type: "String!", __args: { theme: "JSON!" } },
    deleteTheme: { __type: "String!", __args: { id: "String!" } },
    setActiveTheme: { __type: "String!", __args: { id: "String!" } },
    savePost: { __type: "String!", __args: { post: "JSON!" } },
    deletePost: { __type: "String!", __args: { id: "String!" } },
    setPostPublished: { __type: "String!", __args: { id: "String!", publish: "Boolean!" } },
    saveFooter: { __type: "String!", __args: { config: "JSON!" } },
    saveSiteFlags: { __type: "String!", __args: { flags: "JSON!" } },
    saveSiteSeo: { __type: "String!", __args: { seo: "JSON!" } },
  },
  QueryMongo: {
    __typename: { __type: "String!" },
    getImages: { __type: "[IImage!]!", __args: { tags: "String!" } },
    getLanguages: { __type: "[INewLanguage]" },
    getLogo: { __type: "ILogo" },
    getMongoDBUri: { __type: "String" },
    getNavigationCollection: { __type: "[INavigation!]!" },
    getSections: { __type: "[ISection!]!", __args: { ids: "[String]" } },
    getUser: { __type: "IUser", __args: { email: "String" } },
    getUsers: { __type: "[IUser!]!" },
    loadData: { __type: "[ILoadData!]!" },
    setupAdmin: { __type: "IUser" },
    getPublishedSnapshot: { __type: "String" },
    getPublishedMeta: { __type: "String" },
    getThemes: { __type: "String!" },
    getActiveTheme: { __type: "String" },
    getPublishedHistory: { __type: "String!", __args: { limit: "Int" } },
    getPosts: { __type: "String!", __args: { includeDrafts: "Boolean", limit: "Int" } },
    getPost: { __type: "String", __args: { slug: "String!", includeDrafts: "Boolean" } },
    getFooter: { __type: "String!" },
    getSiteFlags: { __type: "String!" },
    getSiteSeo: { __type: "String!" },
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
  created: ScalarsEnums["String"];
  id: ScalarsEnums["String"];
  location: ScalarsEnums["String"];
  name: ScalarsEnums["String"];
  size: ScalarsEnums["Int"];
  tags: Array<Maybe<ScalarsEnums["String"]>>;
  type: ScalarsEnums["String"];
}

export interface IItem {
  __typename?: "IItem";
  action?: Maybe<ScalarsEnums["String"]>;
  actionContent?: Maybe<ScalarsEnums["String"]>;
  actionStyle?: Maybe<ScalarsEnums["String"]>;
  actionType?: Maybe<ScalarsEnums["String"]>;
  content: ScalarsEnums["String"];
  name?: Maybe<ScalarsEnums["String"]>;
  style?: Maybe<ScalarsEnums["String"]>;
  type: ScalarsEnums["String"];
}

export interface ILoadData {
  __typename?: "ILoadData";
  empty?: Maybe<ScalarsEnums["Boolean"]>;
  name?: Maybe<ScalarsEnums["String"]>;
  sizeOnDisk?: Maybe<ScalarsEnums["Float"]>;
}

export interface ILogo {
  __typename?: "ILogo";
  content: ScalarsEnums["String"];
  id?: Maybe<ScalarsEnums["String"]>;
  type?: Maybe<ScalarsEnums["String"]>;
  editedBy?: Maybe<ScalarsEnums["String"]>;
  editedAt?: Maybe<ScalarsEnums["String"]>;
}

export interface INavigation {
  __typename?: "INavigation";
  id?: Maybe<ScalarsEnums["String"]>;
  page: ScalarsEnums["String"];
  sections: Array<Maybe<ScalarsEnums["String"]>>;
  seo?: Maybe<ISeo>;
  type: ScalarsEnums["String"];
  editedBy?: Maybe<ScalarsEnums["String"]>;
  editedAt?: Maybe<ScalarsEnums["String"]>;
}

export interface INewLanguage {
  __typename?: "INewLanguage";
  default?: Maybe<ScalarsEnums["Boolean"]>;
  label: ScalarsEnums["String"];
  symbol: ScalarsEnums["String"];
  flag?: Maybe<ScalarsEnums["String"]>;
  editedBy?: Maybe<ScalarsEnums["String"]>;
  editedAt?: Maybe<ScalarsEnums["String"]>;
}

export interface ISection {
  __typename?: "ISection";
  content?: Maybe<Array<Maybe<IItem>>>;
  id?: Maybe<ScalarsEnums["String"]>;
  page?: Maybe<ScalarsEnums["String"]>;
  type: ScalarsEnums["Int"];
  slots?: Maybe<Array<Maybe<ScalarsEnums["Int"]>>>;
  overlay?: Maybe<ScalarsEnums["Boolean"]>;
  overlayAnchor?: Maybe<ScalarsEnums["String"]>;
  editedBy?: Maybe<ScalarsEnums["String"]>;
  editedAt?: Maybe<ScalarsEnums["String"]>;
}

export interface ISeo {
  __typename?: "ISeo";
  author?: Maybe<ScalarsEnums["String"]>;
  charSet?: Maybe<ScalarsEnums["String"]>;
  description?: Maybe<ScalarsEnums["String"]>;
  image?: Maybe<ScalarsEnums["String"]>;
  image_alt?: Maybe<ScalarsEnums["String"]>;
  keywords?: Maybe<Array<Maybe<ScalarsEnums["String"]>>>;
  locale?: Maybe<ScalarsEnums["String"]>;
  modified_time?: Maybe<ScalarsEnums["String"]>;
  published_time?: Maybe<ScalarsEnums["String"]>;
  url?: Maybe<ScalarsEnums["String"]>;
  viewport?: Maybe<ScalarsEnums["String"]>;
}

export interface IUser {
  __typename?: "IUser";
  avatar?: Maybe<ScalarsEnums["String"]>;
  canPublishProduction?: Maybe<ScalarsEnums["Boolean"]>;
  email: ScalarsEnums["String"];
  id: ScalarsEnums["String"];
  name?: Maybe<ScalarsEnums["String"]>;
  password: ScalarsEnums["String"];
  role?: Maybe<ScalarsEnums["String"]>;
}

export interface MutationMongo {
  __typename?: "MutationMongo";
  addUpdateLanguage: (args?: {
    language?: Maybe<InLanguage>;
    translations?: Maybe<ScalarsEnums["JSON"]>;
  }) => ScalarsEnums["String"];
  addUpdateNavigationItem: (args: {
    pageName: ScalarsEnums["String"];
    sections?: Maybe<Array<Maybe<ScalarsEnums["String"]>>>;
  }) => ScalarsEnums["String"];
  addUpdateSectionItem: (args: {
    pageName?: Maybe<ScalarsEnums["String"]>;
    section: InSection;
  }) => ScalarsEnums["String"];
  createNavigation: (args: {
    navigation: InNavigation;
  }) => ScalarsEnums["String"];
  deleteImage: (args: { id: ScalarsEnums["String"] }) => ScalarsEnums["String"];
  deleteLanguage: (args?: {
    language?: Maybe<InLanguage>;
  }) => ScalarsEnums["String"];
  deleteNavigationItem: (args: {
    pageName: ScalarsEnums["String"];
  }) => ScalarsEnums["String"];
  removeSectionItem: (args: {
    id: ScalarsEnums["String"];
  }) => ScalarsEnums["String"];
  replaceUpdateNavigation: (args: {
    navigation?: Maybe<InNavigation>;
    oldPageName: ScalarsEnums["String"];
  }) => ScalarsEnums["String"];
  saveImage: (args: { image: InImage }) => ScalarsEnums["String"];
  saveLogo: (args: {
    content: ScalarsEnums["String"];
  }) => ScalarsEnums["String"];
  updateNavigation: (args: {
    page: ScalarsEnums["String"];
    sections?: Maybe<Array<Maybe<ScalarsEnums["String"]>>>;
  }) => ScalarsEnums["String"];
  addUser: (args: { user: InUser }) => ScalarsEnums["String"];
  updateUser: (args: { user: InUser }) => ScalarsEnums["String"];
  removeUser: (args: { id: ScalarsEnums["String"] }) => ScalarsEnums["String"];
  publishSnapshot: (args?: { note?: Maybe<ScalarsEnums["String"]> }) => ScalarsEnums["String"];
  rollbackToSnapshot: (args: { id: ScalarsEnums["String"] }) => ScalarsEnums["String"];
  savePost: (args: { post: unknown }) => ScalarsEnums["String"];
  deletePost: (args: { id: ScalarsEnums["String"] }) => ScalarsEnums["String"];
  setPostPublished: (args: { id: ScalarsEnums["String"]; publish: ScalarsEnums["Boolean"] }) => ScalarsEnums["String"];
  saveFooter: (args: { config: unknown }) => ScalarsEnums["String"];
  saveSiteFlags: (args: { flags: unknown }) => ScalarsEnums["String"];
  saveSiteSeo: (args: { seo: unknown }) => ScalarsEnums["String"];
  saveTheme: (args: { theme: unknown }) => ScalarsEnums["String"];
  deleteTheme: (args: { id: ScalarsEnums["String"] }) => ScalarsEnums["String"];
  setActiveTheme: (args: { id: ScalarsEnums["String"] }) => ScalarsEnums["String"];
}

export interface InUser {
  avatar?: Maybe<ScalarsEnums["String"]>;
  canPublishProduction?: Maybe<ScalarsEnums["Boolean"]>;
  email?: Maybe<ScalarsEnums["String"]>;
  id?: Maybe<ScalarsEnums["String"]>;
  name?: Maybe<ScalarsEnums["String"]>;
  password?: Maybe<ScalarsEnums["String"]>;
  role?: Maybe<ScalarsEnums["String"]>;
}

export interface QueryMongo {
  __typename?: "QueryMongo";
  getImages: (args: { tags: ScalarsEnums["String"] }) => Array<IImage>;
  getLanguages?: Maybe<Array<Maybe<INewLanguage>>>;
  getLogo?: Maybe<ILogo>;
  getMongoDBUri?: Maybe<ScalarsEnums["String"]>;
  getNavigationCollection: Array<INavigation>;
  getSections: (args?: {
    ids?: Maybe<Array<Maybe<ScalarsEnums["String"]>>>;
  }) => Array<ISection>;
  getUser: (args?: { email?: Maybe<ScalarsEnums["String"]> }) => Maybe<IUser>;
  getUsers: Array<IUser>;
  loadData: Array<ILoadData>;
  setupAdmin?: Maybe<IUser>;
  getPublishedSnapshot?: Maybe<ScalarsEnums["String"]>;
  getPublishedMeta?: Maybe<ScalarsEnums["String"]>;
  getThemes: ScalarsEnums["String"];
  getActiveTheme?: Maybe<ScalarsEnums["String"]>;
  getPublishedHistory: (args?: { limit?: Maybe<ScalarsEnums["Int"]> }) => ScalarsEnums["String"];
  getPosts: (args?: { includeDrafts?: Maybe<ScalarsEnums["Boolean"]>; limit?: Maybe<ScalarsEnums["Int"]> }) => ScalarsEnums["String"];
  getPost: (args: { slug: ScalarsEnums["String"]; includeDrafts?: Maybe<ScalarsEnums["Boolean"]> }) => Maybe<ScalarsEnums["String"]>;
  getFooter: ScalarsEnums["String"];
  getSiteFlags: ScalarsEnums["String"];
  getSiteSeo: ScalarsEnums["String"];
}

export interface Mutation {
  __typename?: "Mutation";
  mongo: MutationMongo;
}

export interface Query {
  __typename?: "Query";
  bar: ScalarsEnums["String"];
  greeting: ScalarsEnums["String"];
  mongo: QueryMongo;
  sample: ScalarsEnums["String"];
}

export interface Subscription {
  __typename?: "Subscription";
}

export interface GeneratedSchema {
  query: Query;
  mutation: Mutation;
  subscription: Subscription;
}

export type ScalarsEnums = {
  [Key in keyof Scalars]: Scalars[Key] extends { output: unknown }
    ? Scalars[Key]["output"]
    : never;
} & {};
