export type RestoreManifest=Record<string,unknown>
export function parseRestoreManifest(value:unknown):RestoreManifest
export function assertRestoreTarget(env:Record<string,string|undefined>,manifest:RestoreManifest):void
export function verifyRestore(manifest:RestoreManifest,env?:Record<string,string|undefined>):Promise<{status:string;checks:string[];[key:string]:unknown}>
export function readRestoreManifest(path:string):Promise<RestoreManifest>
