import React, {createContext, useContext} from 'react';
import type {IPost} from '../../Interfaces/IPost';

/**
 * When pages are rendered via `getStaticProps`, posts are fetched once at build
 * time and injected here so `BlogFeed` items paint immediately in HTML. In dev
 * the context is absent and `BlogFeed` falls back to its client-side fetch.
 */
const PostsContext = createContext<IPost[] | null>(null);

export const PostsProvider: React.FC<{value: IPost[] | null; children: React.ReactNode}> = ({value, children}) => (
    <PostsContext.Provider value={value}>{children}</PostsContext.Provider>
);

export const usePrefetchedPosts = (): IPost[] | null => useContext(PostsContext);

export default PostsContext;
