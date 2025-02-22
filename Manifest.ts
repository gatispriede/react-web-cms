import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Sample page',
        short_name: 'Sample',
        description: 'Sample',
        start_url: '/',
        display: 'standalone',
        background_color: '#fff',
        theme_color: '#fff',
        icons: [
            {
                src: '/api/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
        ],
    }
}