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
const isDocker = node_port !== 80 && node_port !== '80';
// Browser requests use a relative URL so they go through the public host.
// SSR requests use the Docker-internal address directly.
const isBrowser = typeof window !== 'undefined';
const fetchUrl = isBrowser
    ? '/api/graphql'
    : isDocker
        ? `http://server:${node_port}/`
        : `http://localhost:${node_port}/api/graphql`;

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

  return await defaultResponseHandler(response as Response);
};

const cache = new Cache(
  undefined,
  /**
   * Admin mutations (delete section, reorder, update content) don't tell GQty
   * which queries to invalidate — arrays of ID strings inside `INavigation`
   * aren't covered by the normalization graph. With any nonzero maxAge we
   * serve stale navigation right after a delete and the "deleted row pops
   * back on refresh" bug reappears.
   *
   * maxAge: 0 + staleWhileRevalidate: 0 = always fetch fresh. The admin UI
   * is low-traffic so the extra round-trips are fine; the public site goes
   * through SSG (`gqlFetch.ts`), not this client.
   */
  {
    maxAge: 0,
    staleWhileRevalidate: 0,
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

/**
 * Clear all cached query data. Call after any destructive mutation
 * (create / update / delete / reorder) so the next read returns live
 * server state. `maxAge: 0` alone isn't enough if HMR or React scheduling
 * replays an in-flight result; an explicit clear removes the ambiguity.
 */
export function invalidateCache(): void {
  try {
    cache.clear();
  } catch (err) {
    console.warn('[gqty] cache.clear() failed:', err);
  }
}

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
