const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('about credits match owner wording and website is a link not a button',()=>{
 const s=fs.readFileSync(require.resolve('../src/settings.js'),'utf8');
 assert.match(s,/作者：阿寶/);assert.match(s,/出張嘴：羽山秋人/);
 assert.match(s,/<a id="authorSite" href="https:\/\/3wa\.tw"[^>]*>https:\/\/3wa\.tw<\/a>/);
 assert.doesNotMatch(s,/<button id="authorSite"/);
});

test('about is concise and actions share a right aligned row',()=>{
 const s=fs.readFileSync(require.resolve('../src/settings.js'),'utf8');
 assert.doesNotMatch(s,/本機預覽（未發布變更）|本機離線模型檢視器|檢查結果顯示在主視窗底部/);
 assert.match(s,/<div id="aboutUpdates" class="dialogActions aboutActions"><button id="aboutClose">/);
 assert.match(fs.readFileSync(require.resolve('../src/style.css'),'utf8'),/#aboutDialog \.aboutActions \{ justify-content: flex-end;/);
});

test('update feedback is indeterminate and cleaned in finally',()=>{
 const s=fs.readFileSync(require.resolve('../src/settings.js'),'utf8'); const v=fs.readFileSync(require.resolve('../src/viewer.js'),'utf8');
 assert.match(s,/<progress id="updateProgress" aria-label="正在檢查更新" hidden><\/progress>/);
 assert.ok(v.includes("$('updateProgress').hidden=false"));
 assert.ok(v.includes("finally{$('updateProgress').hidden=true"));
 assert.ok(v.includes("$('updateResult').textContent=$('status').textContent"));
});

test('update progress runs only while request is pending and stops on success or error',async()=>{
 const vm=require('node:vm');const v=fs.readFileSync(require.resolve('../src/viewer.js'),'utf8');
 const handler=v.split("$('updates').onclick=")[1].split("\n$('release').onclick=")[0];
 const nodes=Object.fromEntries(['updates','updateProgress','updateResult','aboutDialog','release','status'].map(k=>[k,{hidden:true,setAttribute(n,v){this[n]=v;}}]));
 let resolve;let query=()=>new Promise(r=>resolve=r);
 const fn=vm.runInNewContext(handler,{$:id=>nodes[id],window:{viewer:{checkUpdates:()=>query()}}});
 const pending=fn();assert.equal(nodes.updateProgress.hidden,false);assert.equal(nodes.updates.disabled,true);
 resolve({version:'20261111.001',current:'20261111.001',available:false});await pending;
 assert.equal(nodes.updateProgress.hidden,true);assert.equal(nodes.updates.disabled,false);assert.equal(nodes.updateResult.hidden,false);
 query=async()=>{throw new Error('offline');};await fn();assert.equal(nodes.updateProgress.hidden,true);assert.equal(nodes.updates.disabled,false);assert.ok(nodes.updateResult.textContent);
});

test('project website is a fixed trusted text link',()=>{
 const s=fs.readFileSync(require.resolve('../src/settings.js'),'utf8'); const m=fs.readFileSync(require.resolve('../src/main.cjs'),'utf8');
 assert.ok(s.includes('官網：<a id="projectSite" href="https://github.com/shadowjohn/3wa_3dviewer">'));
 assert.ok(m.includes("handle('project-site',()=>shell.openExternal('https://github.com/shadowjohn/3wa_3dviewer'))"));
});
