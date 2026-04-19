export interface IPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    coverImage?: string;
    tags: string[];
    author?: string;
    publishedAt?: string;
    draft: boolean;
    body: string;
    createdAt: string;
    updatedAt: string;
    editedBy?: string;
    editedAt?: string;
}

export interface InPost {
    id?: string;
    slug: string;
    title: string;
    excerpt?: string;
    coverImage?: string;
    tags?: string[];
    author?: string;
    publishedAt?: string;
    draft?: boolean;
    body: string;
}
