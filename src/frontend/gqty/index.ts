/**
 * GQty: You can safely modify this file based on your needs.
 */

import {
  Cache,
  createClient,
  defaultResponseHandler,
  type QueryFetcher,
} from "gqty";
import {
  generatedSchema,
  scalarsEnumsHash,
  type GeneratedSchema,
} from "./schema.generated";

// import IP from '../../../IP'
const node_port = process.env.BUILD_PORT || 80;
const serverIP = node_port !== 80 ? 'server' : 'localhost';
const port = '' + node_port
const serverAddress = `http://${serverIP}:${port}`;
const fetchUrl = `${serverAddress}/api/graphql`

const queryFetcher: QueryFetcher = async function (
  { query, variables, operationName },
  fetchOptions
) {

  const response = await fetch(fetchUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
      operationName,
    }),
    mode: "cors",
    ...fetchOptions,
  }).catch(err => {
    console.error(err)
  });

  return await defaultResponseHandler(<Response>response);
};

const cache = new Cache(
  undefined,
  /**
   * Default option is immediate cache expiry but keep it for 5 minutes,
   * allowing soft refetches in background.
   */
  {
    maxAge: 5 * 60 * 1000,
    staleWhileRevalidate: 5 * 60 * 1000,
    normalization: true,
  }
);

export const client = createClient<GeneratedSchema>({
  schema: generatedSchema,
  scalars: scalarsEnumsHash,
  cache,
  fetchOptions: {
    fetcher: queryFetcher,
  },
});

// Core functions
export const { resolve, subscribe, schema } = client;

// Legacy functions
export const {
  query,
  mutation,
  mutate,
  subscription,
  resolved,
  refetch,
  track,
} = client;
