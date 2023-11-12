export const passwordsFeature = () => {
    return new Promise(async (resolve) => {
        let pfeature = await import('@adminjs/passwords')
        resolve(pfeature)
    })
}