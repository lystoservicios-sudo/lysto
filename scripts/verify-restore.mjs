import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { readRestoreManifest,verifyRestore } from './lib/restore-verification.mjs'

const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined}
const path=value('--manifest'),output=value('--output')
if(!path)throw new Error('Usage: node scripts/verify-restore.mjs --manifest <path> [--output <path>]')
const result=await verifyRestore(await readRestoreManifest(resolve(path)))
const json=`${JSON.stringify(result,null,2)}\n`;if(output)await writeFile(resolve(output),json,{flag:'wx'});process.stdout.write(json)
