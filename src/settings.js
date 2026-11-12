// Only local UI. OS registration stays behind a validated main-process IPC.
const settings=document.createElement('dialog');settings.id='settingsDialog';
settings.innerHTML=`<h2>設定 · 檔案關聯</h2><p>只列目前真正支援的格式。勾選並確認後，會註冊「開啟方式」候選，不會強制取代 Windows 預設程式。</p><p class="muted">接著在 Windows 預設應用程式依副檔名搜尋，選擇 3WA 3D Viewer。移動 portable 資料夾後，請重新設定。</p><fieldset id="associationFormats"><legend>檔案類型</legend></fieldset><div class="dialogActions"><button id="assocAll">全選</button><button id="assocNone">清除選取</button></div><p id="assocPath" class="muted"></p><p id="assocResult" role="status" aria-live="polite"></p><div class="dialogActions"><button id="assocApply" class="primary">確定：註冊所選格式</button><button id="assocWindows">開啟 Windows 預設應用程式</button><button id="settingsClose">關閉</button></div>`;
document.body.append(settings);
const about=document.createElement('dialog');about.id='aboutDialog';
about.innerHTML=`<h2>關於 3WA 3D Viewer</h2><p id="aboutVersion"></p><p>作者：阿寶<br>出張嘴：羽山秋人　（<a id="authorSite" href="https://3wa.tw">https://3wa.tw</a>）</p><p>官網：<a id="projectSite" href="https://github.com/shadowjohn/3wa_3dviewer">https://github.com/shadowjohn/3wa_3dviewer</a></p><progress id="updateProgress" aria-label="正在檢查更新" hidden></progress><p id="updateResult" role="status" aria-live="polite" hidden></p><div id="aboutUpdates" class="dialogActions aboutActions"><button id="aboutClose">關閉</button></div>`;
document.body.append(about);
const header=document.querySelector('header'),settingsButton=document.createElement('button'),aboutButton=document.createElement('button');
settingsButton.id='settings';settingsButton.textContent='設定';aboutButton.id='about';aboutButton.textContent='關於';header.append(settingsButton,aboutButton);
document.getElementById('aboutUpdates').prepend(document.getElementById('updates'),document.getElementById('release'));
const $=id=>document.getElementById(id),checks=()=>[...settings.querySelectorAll('input[type=checkbox]')];
let registering=false;
function sync(){ $('assocApply').disabled=registering||!checks().some(c=>c.checked); }
settingsButton.onclick=async()=>{
 $('assocResult').textContent='';$('associationFormats').replaceChildren();
 try{const data=await window.viewer.associationOptions();
  for(const ext of data.formats){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.value=ext;input.onchange=sync;label.append(input,document.createTextNode(ext));$('associationFormats').append(label);}
  $('assocPath').textContent=data.exe?'目前程式：'+data.exe:'開發模式：請用 Windows portable 執行檔設定。';
  $('assocAll').disabled=$('assocNone').disabled=!data.available;checks().forEach(c=>c.disabled=!data.available);sync();
 }catch(e){$('assocResult').textContent=e.message;sync();}
 settings.showModal();
};
$('assocAll').onclick=()=>{checks().filter(c=>!c.disabled).forEach(c=>c.checked=true);sync();};
$('assocNone').onclick=()=>{checks().forEach(c=>c.checked=false);sync();};
$('assocApply').onclick=async()=>{
 if(registering)return;const values=checks().filter(c=>c.checked).map(c=>c.value);registering=true;sync();
 try{const r=await window.viewer.registerAssociations(values);
  $('assocResult').textContent=(r.registered.length?'已註冊候選：'+r.registered.join('、')+'。尚未確認為預設；請按「開啟 Windows 預設應用程式」完成選擇。':'未完成註冊。')+(r.failed.length?' 失敗：'+r.failed.map(f=>f.extension+' '+f.error).join('；'):'');
 }catch(e){$('assocResult').textContent='註冊失敗：'+e.message;}finally{registering=false;sync();}
};
$('assocWindows').onclick=async()=>{try{await window.viewer.associationSettings();}catch(e){$('assocResult').textContent='無法開啟 Windows 設定：'+e.message;}};
$('settingsClose').onclick=()=>settings.close();
aboutButton.onclick=async()=>{try{const c=await window.viewer.config();$('aboutVersion').textContent='版本：'+c.version;}catch(e){$('aboutVersion').textContent=e.message;}about.showModal();};
$('aboutClose').onclick=()=>about.close();
$('authorSite').onclick=async event=>{event.preventDefault();try{await window.viewer.authorSite();}catch(e){$('aboutVersion').textContent='無法開啟作者網站：'+e.message;}};
// Do not let model shortcuts or file drops fire behind a modal dialog.
window.addEventListener('keydown',e=>{if(settings.open||about.open)e.stopImmediatePropagation();},true);
window.addEventListener('drop',e=>{if(settings.open||about.open){e.preventDefault();e.stopImmediatePropagation();}},true);

$('projectSite').onclick=async event=>{event.preventDefault();try{await window.viewer.projectSite();}catch(e){$('aboutVersion').textContent='無法開啟官網：'+e.message;}};
