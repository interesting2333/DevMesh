export type WorkbenchRead=(path:string)=>Promise<unknown>;
export type WorkbenchCommand=(path:string,init:RequestInit)=>Promise<unknown>;
export class WorkbenchApiError extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
