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
}

export interface InItem {
  content?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  type?: InputMaybe<Scalars["String"]["input"]>;
}

export const scalarsEnumsHash: ScalarsEnumsHash = {
  Boolean: true,
  Float: true,
  Int: true,
  String: true,
};
export const generatedSchema = {
  IItem: {
    __typename: { __type: "String!" },
    content: { __type: "String" },
    name: { __type: "String" },
    type: { __type: "String" },
  },
  ILoadData: {
    __typename: { __type: "String!" },
    empty: { __type: "Boolean" },
    name: { __type: "String" },
    sizeOnDisk: { __type: "Float" },
  },
  INavigation: {
    __typename: { __type: "String!" },
    id: { __type: "String" },
    page: { __type: "String" },
    sections: { __type: "[String]" },
    type: { __type: "String" },
  },
  ISection: {
    __typename: { __type: "String!" },
    content: { __type: "[IItem]" },
    id: { __type: "String" },
    type: { __type: "Int" },
  },
  InItem: {
    content: { __type: "String" },
    name: { __type: "String" },
    type: { __type: "String" },
  },
  MMongo: {
    __typename: { __type: "String!" },
    addUpdateNavigationItem: {
      __type: "String",
      __args: { pageName: "String!", sections: "[String]" },
    },
    addUpdateSectionItem: {
      __type: "String",
      __args: {
        content: "[InItem]!",
        id: "String",
        pageName: "String",
        type: "Int!",
      },
    },
    deleteNavigationItem: { __type: "String", __args: { pageName: "String!" } },
    removeSectionItem: { __type: "String", __args: { id: "String!" } },
  },
  TMongo: {
    __typename: { __type: "String!" },
    createDatabase: { __type: "String" },
    getMongoDBUri: { __type: "String" },
    getNavigationCollection: { __type: "[INavigation]" },
    getSections: { __type: "[ISection]", __args: { ids: "[String]" } },
    loadData: { __type: "[ILoadData]" },
  },
  mutation: { __typename: { __type: "String!" }, mongo: { __type: "MMongo" } },
  query: {
    __typename: { __type: "String!" },
    bar: { __type: "String" },
    greeting: { __type: "String" },
    mongo: { __type: "TMongo" },
    sample: { __type: "String" },
  },
  subscription: {},
} as const;

export interface IItem {
  __typename?: "IItem";
  content?: Maybe<ScalarsEnums["String"]>;
  name?: Maybe<ScalarsEnums["String"]>;
  type?: Maybe<ScalarsEnums["String"]>;
}

export interface ILoadData {
  __typename?: "ILoadData";
  empty?: Maybe<ScalarsEnums["Boolean"]>;
  name?: Maybe<ScalarsEnums["String"]>;
  sizeOnDisk?: Maybe<ScalarsEnums["Float"]>;
}

export interface INavigation {
  __typename?: "INavigation";
  id?: Maybe<ScalarsEnums["String"]>;
  page?: Maybe<ScalarsEnums["String"]>;
  sections?: Maybe<Array<Maybe<ScalarsEnums["String"]>>>;
  type?: Maybe<ScalarsEnums["String"]>;
}

export interface ISection {
  __typename?: "ISection";
  content?: Maybe<Array<Maybe<IItem>>>;
  id?: Maybe<ScalarsEnums["String"]>;
  type?: Maybe<ScalarsEnums["Int"]>;
}

export interface MMongo {
  __typename?: "MMongo";
  addUpdateNavigationItem: (args: {
    pageName: ScalarsEnums["String"];
    sections?: Maybe<Array<Maybe<ScalarsEnums["String"]>>>;
  }) => Maybe<ScalarsEnums["String"]>;
  addUpdateSectionItem: (args: {
    content: Array<Maybe<InItem>>;
    id?: Maybe<ScalarsEnums["String"]>;
    pageName?: Maybe<ScalarsEnums["String"]>;
    type: ScalarsEnums["Int"];
  }) => Maybe<ScalarsEnums["String"]>;
  deleteNavigationItem: (args: {
    pageName: ScalarsEnums["String"];
  }) => Maybe<ScalarsEnums["String"]>;
  removeSectionItem: (args: {
    id: ScalarsEnums["String"];
  }) => Maybe<ScalarsEnums["String"]>;
}

export interface TMongo {
  __typename?: "TMongo";
  createDatabase?: Maybe<ScalarsEnums["String"]>;
  getMongoDBUri?: Maybe<ScalarsEnums["String"]>;
  getNavigationCollection?: Maybe<Array<Maybe<INavigation>>>;
  getSections: (args?: {
    ids?: Maybe<Array<Maybe<ScalarsEnums["String"]>>>;
  }) => Maybe<Array<Maybe<ISection>>>;
  loadData?: Maybe<Array<Maybe<ILoadData>>>;
}

export interface Mutation {
  __typename?: "Mutation";
  mongo?: Maybe<MMongo>;
}

export interface Query {
  __typename?: "Query";
  bar?: Maybe<ScalarsEnums["String"]>;
  greeting?: Maybe<ScalarsEnums["String"]>;
  mongo?: Maybe<TMongo>;
  sample?: Maybe<ScalarsEnums["String"]>;
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
