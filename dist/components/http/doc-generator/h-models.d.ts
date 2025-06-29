/**
 * Generate JSON schema for a Sequelize attribute
 *
 * @param {Attribute} att Sequelize attribute
 * @returns {Object} property schema
 */
declare function getAttributeSchema(att: any): any;
/**
 * Generate JSON Schema for a Sequelize Model
 *
 * @param {Model} model Sequelize.Model to schema-ify
 * @param {Object} options Optional options
 * @param {Array} options.attributes Attributes to include in schema
 * @param {Array} options.exclude  Attributes to exclude from schema (overrides
 * `attributes`)
 */
declare function getModelSchema(model: any, options?: {}): {
    properties: {};
    required: any[];
    type: string;
};
declare function getSequelizeSchema(seq: any, options?: {}): {
    definitions: {};
    type: string;
    $schema: string;
};
export { getAttributeSchema, getModelSchema, getSequelizeSchema, };
