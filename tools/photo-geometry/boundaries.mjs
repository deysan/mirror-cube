#!/usr/bin/env node
// Complete offline boundary extraction -> explicit review -> observation diagnostics workflow. No state import.
import { readFile, writeFile, mkdir, realpath, access } from 'node:fs/promises';
import { dirname, basename, resolve, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { decodeImage, imageMime } from './decodeImage.mjs';
import { findBoundaryCandidates } from './boundaryCandidates.ts';
import { createReviewTemplate, evaluateReview, validateCatalog } from './boundaryReview.ts';
import { fitSharedCamera, probeCameraSensitivity } from './sharedCamera.ts';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
async function newOutput(path) {
  const repository = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
  const output = join(await realpath(dirname(resolve(path))), basename(resolve(path)));
  if (output === repository || output.startsWith(repository + sep)) throw Error('Private reports must be outside the repository.');
  try { await access(output); throw Error('Output already exists.'); } catch (e) { if(e.code!=='ENOENT')throw e; }
  return output;
}
const save = (dir, name, value) => writeFile(join(dir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});

export async function prepareBoundaries(inputPath, outputPath, decode = decodeImage) {
  const output=await newOutput(outputPath), inputBytes=await readFile(inputPath), input=JSON.parse(inputBytes);
  if(input.mode!=='shared-camera'||!Array.isArray(input.views)||!input.views.length||input.views.length>10
    ||input.views.some(v=>!v||typeof v.id!=='string'||!v.id.trim()||typeof v.image!=='string'||!v.image.trim())
    ||new Set(input.views.map(v=>v.id)).size!==input.views.length)throw Error('Expected uniquely named shared-camera views with local images.');
  for(const v of input.views)fitSharedCamera(v);
  const views=[],images=[];
  for(const view of input.views){
    const bytes=await readFile(resolve(dirname(resolve(inputPath)),view.image)),mime=imageMime(bytes),image=await decode(bytes,view.width,view.height);
    if(image.width!==view.width||image.height!==view.height)throw Error('Decoded dimensions do not match annotations.');
    const edges=['a','b','c'].flatMap(axis=>view.groups[axis].map(mark=>({id:mark.id,axis,role:mark.role,original:mark.segment,...findBoundaryCandidates(image,mark.segment)})));
    views.push({id:view.id,width:view.width,height:view.height,sourceSha256:hash(bytes),graySha256:hash(image.data),decoder:image.decoder??'test-decoder',edges});
    images.push({mime,bytes});
  }
  const implementationSha256=Object.fromEntries(await Promise.all(['boundaries.mjs','boundaryCandidates.ts','boundaryReview.ts','reviewUi.js','refineEdge.ts','decodeImage.mjs','sharedCamera.ts','geometry.ts'].map(async name=>[name,hash(await readFile(new URL(name,import.meta.url)))])));
  const payload={version:1,inputSha256:hash(inputBytes),implementationSha256,views};
  const catalog={...payload,catalogId:hash(JSON.stringify(payload))};validateCatalog(catalog);
  const template=createReviewTemplate(catalog),ui=await readFile(new URL('reviewUi.js',import.meta.url),'utf8');
  const scriptHash=createHash('sha256').update(ui).digest('base64');
  const embedded=JSON.stringify({catalog,template}).replace(/</g,'\\u003c');
  let index=0;
  const colors=['#4dffb1','#ffff5a','#66caff','#ff9e50','#c994ff','#ff7373','#abff61','#fff'];
  const panels=views.map((v,vi)=>`<section><h2>${escape(v.id)}</h2>${v.edges.map(e=>{
    const row=index++,[a,b]=e.original,pad=30,x=Math.max(0,Math.min(a[0],b[0])-pad),y=Math.max(0,Math.min(a[1],b[1])-pad);
    const w=Math.min(v.width,Math.max(a[0],b[0])+pad)-x,h=Math.min(v.height,Math.max(a[1],b[1])+pad)-y;
    const line=(id,s,color,dashed=false)=>`<line data-choice="${escape(id)}" x1="${s[0][0]}" y1="${s[0][1]}" x2="${s[1][0]}" y2="${s[1][1]}" stroke="${color}" stroke-width="1.5"${dashed?' stroke-dasharray="5 4"':''}/>`;
    return `<article data-row="${row}"><h3>${escape(e.axis)} / ${escape(e.id)}</h3><svg role="img" aria-label="${escape(e.id)}" viewBox="${x} ${y} ${w} ${h}"><use href="#image-${vi}"/>${line('manual',e.original,'#ff65ec',true)}${e.candidates.map((c,i)=>line(c.id,c.segment,colors[i])).join('')}</svg><p>${e.candidates.map((c,i)=>`<span style="color:${colors[i]}">${escape(c.id)}${c.stable?'':' *'}</span>`).join(' · ')}</p><div class="controls"></div></article>`;
  }).join('')}</section>`).join('');
  const definitions=views.map((v,i)=>`<image id="image-${i}" width="${v.width}" height="${v.height}" href="data:${images[i].mime};base64,${images[i].bytes.toString('base64')}"/>`).join('');
  const html=`<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'"><title>MirrorCube boundary review</title><style>body{font:16px system-ui;background:#222;color:white;margin:20px;max-width:1200px}article{border:1px solid #666;margin:20px 0;padding:16px}h3{overflow-wrap:anywhere}article svg{width:100%;max-height:420px}.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}label span{display:block}select,textarea,input[type=text]{box-sizing:border-box;width:100%;font:inherit}textarea{min-height:70px}button{font:inherit;margin:8px;padding:8px}#status,#message{padding:12px}button:disabled{opacity:.5}p{line-height:1.5}label{display:block}</style><h1 id="title"></h1><p id="warning"></p><button id="uk" type="button">Українська</button><button id="en" type="button">English</button><p id="legend"></p><label><span id="name-label"></span><input id="reviewer" type="text" maxlength="200"></label><select id="reviewer-role" aria-label="Reviewer role"></select><label><span id="load-label"></span><input id="load" type="file" accept="application/json,.json"></label><p id="message" role="status"></p><svg width="0" height="0" aria-hidden="true"><defs>${definitions}</defs></svg>${panels}<p id="status" role="status"></p><button id="draft" type="button"></button><button id="save" type="button" disabled></button><script id="review-data" type="application/json">${embedded}</script><script>${ui}</script></html>`;
  await mkdir(output);await save(output,'catalog.json',catalog);await save(output,'review-template.json',template);
  await writeFile(join(output,'review.html'),html,{flag:'wx'});
  return catalog;
}
export async function applyBoundaryReview(catalogPath, reviewPath, outputPath) {
  const output=await newOutput(outputPath),catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  const {catalogId,...payload}=catalog;
  if(catalogId!==hash(JSON.stringify(payload)))throw Error('Catalog contents or fingerprint changed; prepare a new review.');
  const review=JSON.parse(await readFile(reviewPath,'utf8')),result=evaluateReview(catalog,review);
  const diagnostics=result.views.map(v=>({id:v.id,missing:v.missing,calibrationStatus:'unverified',
    nominal:v.observation?fitSharedCamera(v.observation):null,
    sensitivity:v.observation?[0,2,5].map(r=>probeCameraSensitivity(v.observation,r,256,42)):[]}));
  const report={catalogId,reviewSha256:hash(JSON.stringify(review)),...result,diagnostics,
    limitations:['Human boundary type and parallelism declarations are not independent physical verification.',
      'No implicit manual fallback, no excluded held-out checks used to claim complete coverage.',
      'Body-position observations are not dimensions; no camera acceptance, piece identity, or puzzle state is inferred.']};
  await mkdir(output);await save(output,'observations.json',report);return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [command,...args]=process.argv.slice(2);
  try{
    if(command==='prepare'&&args.length===2){const c=await prepareBoundaries(...args);console.log(JSON.stringify({catalogId:c.catalogId,views:c.views.map(v=>({id:v.id,regions:v.edges.length,candidates:v.edges.reduce((s,e)=>s+e.candidates.length,0)})),status:'needs-review'}));}
    else if(command==='review'&&args.length===3){const r=await applyBoundaryReview(...args);console.log(JSON.stringify({status:r.status,pending:r.pending.length,readyForPuzzleState:r.readyForPuzzleState}));}
    else throw Error('Usage: node tools/photo-geometry/boundaries.mjs prepare observations.json NEW_OUTPUT_DIRECTORY\n       node tools/photo-geometry/boundaries.mjs review catalog.json review.json NEW_OUTPUT_DIRECTORY');
  }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
}
