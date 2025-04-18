
const nextUtilsConfig = () => {
    const trueEnv = ['true', '1', 'yes']
    const esmExternals = trueEnv.includes(
        process.env?.NEXTJS_ESM_EXTERNALS ?? 'false'
    )
    const tsconfigPath = process.env.NEXTJS_TSCONFIG_PATH
        ? process.env.NEXTJS_TSCONFIG_PATH
        : './tsconfig.json'

    return {
        esmExternals,
        tsconfigPath,
    }
}

module.exports = {
    loadCustomBuildParams: nextUtilsConfig,
}