/**
 * Etherial Documentation Generator
 *
 * This module provides tools for generating OpenAPI/Swagger documentation
 * from Etherial routes, models, and forms.
 */
export { SwaggerGenerator, SwaggerGeneratorConfig, OpenAPIInfo, OpenAPIServer, RouteInfo, FormInfo, ModelInfo, } from "./swagger-generator";
export { extractForm } from "./h-forms";
export { extractRoutes } from "./h-routes2";
export { getSequelizeSchema, getModelSchema, getAttributeSchema } from "./h-models";
/**
 * @deprecated Use SwaggerGenerator class instead
 */
declare const _default: (etherial: any) => {
    openapi: string;
    info: {
        title: string;
        description: string;
        version: string;
    };
    servers: {
        url: string;
    }[];
    paths: {};
    components: {
        schemas: {};
    };
};
export default _default;
