// TypeScript 6 dropped the automatic ambient CSS declarations that previous
// next-env / @types/node versions provided implicitly. Without these,
// side-effect CSS/SCSS imports (e.g. `import 'foo/dist/style.css'`,
// `import './global.scss'`) fail TS2882. Re-declare the wildcards so the
// imports type-check; bundling is handled by Next/webpack/vite as before.
declare module '*.css';
declare module '*.scss';
declare module '*.sass';
