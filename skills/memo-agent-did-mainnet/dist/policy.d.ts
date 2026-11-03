export type Risk = "R0" | "R1" | "R2" | "R3" | "R4";
export declare function hasLocalR4TestGrant(): boolean;
export declare function authorize(risk: Risk): void;
