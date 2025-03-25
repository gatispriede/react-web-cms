
const { i18n } = require('../../next-i18next.config.js')
const { loadCustomBuildParams } = require('./next-utils.config')
const { tsconfigPath } = loadCustomBuildParams()
/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: [
        //
        "react-drag-reorder",
        "@glidejs",
        "react-glidejs",
        // antd & deps
        "@ant-design",
        "@rc-component",
        "antd",
        "rc-cascader",
        "rc-checkbox",
        "rc-collapse",
        "rc-dialog",
        "rc-drawer",
        "rc-dropdown",
        "rc-field-form",
        "rc-image",
        "rc-input",
        "rc-input-number",
        "rc-mentions",
        "rc-menu",
        "rc-motion",
        "rc-notification",
        "rc-pagination",
        "rc-picker",
        "rc-progress",
        "rc-rate",
        "rc-resize-observer",
        "rc-segmented",
        "rc-select",
        "rc-slider",
        "rc-steps",
        "rc-switch",
        "rc-table",
        "rc-tabs",
        "rc-textarea",
        "rc-tooltip",
        "rc-tree",
        "rc-tree-select",
        "rc-upload",
        "rc-util",
    ],
    env: {
        NEXTAUTH_URL: 'http://localhost:80',
        API_URL: 'http://localhost',
        NEXT_PUBLIC_BASE_URL: 'http://localhost:80',
    },
    i18n: i18n,
    reactStrictMode: true,

    typescript: {
        tsconfigPath,
    },
    sassOptions: {
    },
}

module.exports = nextConfig