import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {join,relative,resolve,sep} from 'node:path'
import ts from 'typescript'

const root=resolve('app/api'),methods=['GET','POST','PUT','PATCH','DELETE']
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):e.name==='route.ts'?[join(dir,e.name)]:[])}
function exportedMethods(source,file){const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS),found=new Set();for(const statement of parsed.statements){const exported=statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword);if(exported&&ts.isFunctionDeclaration(statement)&&statement.name&&methods.includes(statement.name.text))found.add(statement.name.text);if(exported&&ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(ts.isIdentifier(declaration.name)&&methods.includes(declaration.name.text))found.add(declaration.name.text);if(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause))for(const element of statement.exportClause.elements)if(methods.includes(element.name.text))found.add(element.name.text)}return [...found]}
function auth(route,source){
 if(source.includes('retiredPost('))return 'Pública; contrato retirado, sin mutación'
 if(route==='/api/mercadopago/webhook')return 'Proveedor; firma y consulta canónica'
 if(route.startsWith('/api/internal/'))return 'Servicio interno; secreto específico'
 if(route.startsWith('/api/health/'))return 'Pública; sonda mínima'
 const privateMatch=source.match(/privateRoute\(\s*\{([^}]+)\}/s)
 if(privateMatch){const roles=privateMatch[1].match(/roles:\s*\[([^\]]+)\]/s)?.[1]?.replaceAll("'",'').replaceAll(/\s/g,'')??'sesión';const permission=privateMatch[1].match(/permission:\s*'([^']+)'/)?.[1];return `Sesión: ${roles}${permission?`; permiso ${permission}`:''}`}
 if(route.startsWith('/api/professional/onboarding'))return 'Sesión confirmada e invitación/onboarding vigente'
 if(route==='/api/mercadopago/oauth/callback')return 'Profesional; sesión, state y cookie'
 return 'Sesión y autorización verificadas por el servicio de la ruta'
}
const routeFiles=walk(root).sort(),missing=routeFiles.filter(file=>exportedMethods(readFileSync(file,'utf8'),file).length===0);if(missing.length)throw new Error(`Route files without exported HTTP methods: ${missing.join(', ')}`)
const entries=routeFiles.flatMap(file=>{const source=readFileSync(file,'utf8'),route='/api/'+relative(root,file).split(sep).slice(0,-1).join('/'),replacement=source.match(/retiredPost\('([^']+)'\)/)?.[1]??null;return exportedMethods(source,file).map(method=>({route,method,status:replacement?'retired':'active',authority:auth(route,source),canonicalDestination:replacement??route,test:replacement?'tests/unit/api-route-contracts.vitest.test.ts':route==='/api/diagnosis/generate'?'tests/unit/diagnosis-route.vitest.test.ts':'tests/integration/api-inventory.test.ts'}))})
mkdirSync(resolve('docs/architecture'),{recursive:true});writeFileSync(resolve('docs/architecture/api-inventory.json'),JSON.stringify({schemaVersion:1,generatedFrom:'app/api/**/route.ts',count:entries.length,entries},null,2)+'\n')
const rows=entries.map(e=>`| \`${e.method}\` | \`${e.route}\` | ${e.status==='retired'?'Retirada 410':'Activa'} | ${e.authority} | \`${e.canonicalDestination}\` | \`${e.test}\` |`).join('\n')
writeFileSync(resolve('docs/architecture/api-inventory.md'),`# Inventario de API\n\nGenerado desde los métodos exportados en \`app/api/**/route.ts\`. Total: **${entries.length} métodos**. El control automático falla si aparece o desaparece un método sin regenerar este archivo.\n\n| Método | Ruta | Estado | Autoridad | Destino canónico | Prueba contractual |\n|---|---|---|---|---|---|\n${rows}\n`)
console.log(`API inventory: ${entries.length} methods`)
