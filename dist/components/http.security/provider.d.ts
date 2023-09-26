declare function ShouldBeAuthentificate(): MethodDecorator;
declare function ShouldBeAuthentificate(type: "JWT" | "BasicAuth" | "Session"): MethodDecorator;
declare function ShouldBeAuthentificateWithRole(role: any): MethodDecorator;
declare function ShouldBeAuthentificateWithRole(role: any, type: "JWT" | "BasicAuth" | "Session"): MethodDecorator;
export { ShouldBeAuthentificate, ShouldBeAuthentificateWithRole };
