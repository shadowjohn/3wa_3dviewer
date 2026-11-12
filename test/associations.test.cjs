const {test}=require('node:test'),assert=require('node:assert/strict');
const a=require('../src/associations.cjs');
test('association choices are exactly supported formats',()=>assert.deepEqual(a.FORMATS,['.glb','.gltf','.b3dm','.vrm','.obj','.stl','.ply','.dae']));
test('association selection rejects empty unsupported and injected values',()=>{for(const x of [[],null,'.glb',['.exe'],['.glb','x\\y'],['.GLB']])assert.throws(()=>a.planRegistration(x,'D:\\Viewer\\3wa_3dviewer.exe'));});
test('registration only writes selected user classes and no UserChoice',()=>{
 const p=a.planRegistration(['.glb','.glb'],'D:\\My Viewer\\3wa_3dviewer.exe');
 assert.deepEqual(p.selected,['.glb']);assert.ok(p.commands.length>0);
 for(const c of p.commands){assert.equal(c[0],'add');assert.ok(c[1].startsWith('HKCU\\Software\\Classes\\'));assert.doesNotMatch(c.join(' '),/UserChoice|\.vrm|\.gltf|\.b3dm/);}
 assert.ok(p.commands.some(c=>c.includes('"D:\\My Viewer\\3wa_3dviewer.exe" "%1"')));
});
test('registration rejects nonlocal or unsafe executable paths',()=>{for(const p of ['relative.exe','\\\\server\\a.exe','C:\\x"bad.exe','C:\\x.txt'])assert.throws(()=>a.planRegistration(['.glb'],p));});
test('per extension identifiers avoid changing other associations',()=>{const p=a.planRegistration(['.glb','.vrm'],'C:\\v.exe');assert.ok(p.commands.some(c=>c[1].includes('3WA.3DViewer.glb')));assert.ok(p.commands.some(c=>c[1].includes('3WA.3DViewer.vrm')));});
test('registry runner reports per-format partial failure without claiming default',async()=>{
 const r=await a.registerSelected(['.glb','.vrm'],'C:\\v.exe',async args=>{if(args[1].includes('3WA.3DViewer.vrm'))throw Error('denied');});
 assert.deepEqual(r.registered,['.glb']);assert.equal(r.failed[0].extension,'.vrm');assert.equal(r.defaultChanged,false);
});
