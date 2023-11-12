export default {
    passwordsFeature: new Promise(async (resolve) => {
        let feature = await import("@adminjs/passwords") 
        resolve(feature.default)
    })
}
