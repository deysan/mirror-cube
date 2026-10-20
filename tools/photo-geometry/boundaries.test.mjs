import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareBoundaries, applyBoundaryReview } from './boundaries.mjs';
const dirs=[];
const directory=()=>{const p=mkdtempSync(join(tmpdir(),'mirror-boundaries-test-'));dirs.push(p);return p;};
afterEach(()=>{for(const p of dirs.splice(0))rmSync(p,{recursive:true,force:true});});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
function fixture(perspective=false){
 const dir=directory(),input=join(dir,'input.json');writeFileSync(join(dir,'source.png'),png);
 const view={id:'view</h2><script>bad</script>',image:'source.png',width:256,height:256,groups:Object.fromEntries(['a','b','c'].map(axis=>[axis,[0,1,2,3].map(i=>({id:axis+i,role:i===3?'check':'fit',segment:[[40,120+i*3],[216,120+i*3]]}))]))};
 if(perspective){const vanishing=[[-100,-200],[400,-150],[120,500]];
  for(const [axis,marks]of Object.entries(view.groups)){const v=vanishing[['a','b','c'].indexOf(axis)];marks.forEach((m,i)=>{const mid=[90+i*15,100+i*4],dx=v[0]-mid[0],dy=v[1]-mid[1],s=30/Math.hypot(dx,dy);m.segment=[[mid[0]-dx*s,mid[1]-dy*s],[mid[0]+dx*s,mid[1]+dy*s]];});}}
 writeFileSync(input,JSON.stringify({mode:'shared-camera',views:[view]}));
 const image={width:256,height:256,data:Uint8Array.from({length:65536},(_,i)=>Math.round(30+180/(1+Math.exp(-(Math.floor(i/256)+.5-128))))),decoder:'synthetic-stub'};
 return{dir,input,decode:vi.fn(async()=>image)};
}
describe('complete offline boundary review workflow',()=>{
 it('produces a fingerprinted catalog, fully pending template, and escaped self-contained bilingual UI',async()=>{
  const {dir,input,decode}=fixture(),out=join(dir,'prepared');const catalog=await prepareBoundaries(input,out,decode);
  const {catalogId,...payload}=catalog;expect(catalogId).toBe(createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  const template=JSON.parse(readFileSync(join(out,'review-template.json'),'utf8'));expect(template.decisions).toHaveLength(12);
  expect(template.decisions.every(d=>d.action==='pending')).toBe(true);
  const html=readFileSync(join(out,'review.html'),'utf8');expect(html).toContain("default-src 'none'");expect(html).toContain("script-src 'sha256-");
  expect(html).toContain('data:image/png;base64,');expect(html).toContain('Українська');expect(html).toContain('English');
  expect(html).not.toContain('view</h2><script>bad</script>');expect(html).toContain('view\\u003c/h2>');
  const script=html.match(/<script>([\s\S]*)<\/script><\/html>$/)[1];
  expect(html).toContain(createHash('sha256').update(script).digest('base64'));
  const report=await applyBoundaryReview(join(out,'catalog.json'),join(out,'review-template.json'),join(dir,'pending'));
  expect(report.status).toBe('needs-review');expect(report.pending).toHaveLength(12);expect(report.diagnostics).toEqual([]);
 });
 it('exports reviewed observations but never puzzle state, with explicit manual provenance and no dropped checks',async()=>{
  const {dir,input,decode}=fixture(true),out=join(dir,'prepared');await prepareBoundaries(input,out,decode);
  const manifest=JSON.parse(readFileSync(join(out,'review-template.json'),'utf8'));
  manifest.reviewer={name:'Synthetic workflow test, not a physical review',role:'analyst'};
  manifest.decisions=manifest.decisions.map(d=>({...d,action:'use',choice:'manual',kind:'body-edge',purpose:'direction',note:'Synthetic test only.'}));
  const review=join(dir,'review.json');writeFileSync(review,JSON.stringify(manifest));
  const r=await applyBoundaryReview(join(out,'catalog.json'),review,join(dir,'reviewed'));
  expect(r.status).toBe('reviewed-observations');expect(r.readyForPuzzleState).toBe(false);
  expect(r.views[0].selected.every(e=>e.source==='explicit-manual')).toBe(true);
  expect(r.views[0].bodyPositionEdges).toEqual([]);expect(r.diagnostics[0].calibrationStatus).toBe('unverified');
  expect(r.diagnostics[0].nominal.calibration.status).toBe('estimated');
  expect(r.diagnostics[0].nominal.directions.a.checkRmsPx).toBeLessThan(1e-7);
  expect(r.diagnostics[0].sensitivity).toHaveLength(3);
  const again=await applyBoundaryReview(join(out,'catalog.json'),review,join(dir,'repeat'));
  expect(again).toEqual(r);
 });
 it('rejects stale/tampered catalogs and manifests before creating output',async()=>{
  const {dir,input,decode}=fixture(),out=join(dir,'prepared');await prepareBoundaries(input,out,decode);
  const catalog=JSON.parse(readFileSync(join(out,'catalog.json'),'utf8'));catalog.views[0].edges[0].original[0][0]+=1;
  const changed=join(dir,'changed.json');writeFileSync(changed,JSON.stringify(catalog));
  await expect(applyBoundaryReview(changed,join(out,'review-template.json'),join(dir,'bad'))).rejects.toThrow('fingerprint');expect(existsSync(join(dir,'bad'))).toBe(false);
  const manifest=JSON.parse(readFileSync(join(out,'review-template.json'),'utf8'));manifest.catalogId='b'.repeat(64);writeFileSync(changed,JSON.stringify(manifest));
  await expect(applyBoundaryReview(join(out,'catalog.json'),changed,join(dir,'bad'))).rejects.toThrow('stale');
 });
 it('refuses public-repository output and overwrite without decoding images',async()=>{
  const {dir,input,decode}=fixture();await expect(prepareBoundaries(input,resolve(`boundary-test-${process.pid}`),decode)).rejects.toThrow('outside');expect(decode).not.toHaveBeenCalled();
  await expect(prepareBoundaries(input,dir,decode)).rejects.toThrow('already exists');expect(decode).not.toHaveBeenCalled();
 });
});
