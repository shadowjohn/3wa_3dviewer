const DISPLAY_VERSION='20261111.001';
const REPO='shadowjohn/3wa_3dviewer';
function parseVersion(value){const match=/^v?(\d{8})\.(\d{3})$/.exec(value||'');return match?[Number(match[1]),Number(match[2])]:null;}
function compareVersions(a,b){const x=parseVersion(a),y=parseVersion(b);if(!x||!y)throw Error('版本格式無效。');return x[0]-y[0]||x[1]-y[1];}
function latestRelease(data,current=DISPLAY_VERSION){if(!Array.isArray(data))throw Error('GitHub 回應格式不符。');const releases=data.filter(r=>!r.draft&&!r.prerelease&&parseVersion(r.tag_name)&&r.html_url===`https://github.com/${REPO}/releases/tag/${r.tag_name}`);releases.sort((a,b)=>compareVersions(b.tag_name,a.tag_name));const latest=releases[0];return latest?{available:compareVersions(latest.tag_name,current)>0,version:latest.tag_name,url:latest.html_url,current}:{available:false,version:null,current};}
module.exports={DISPLAY_VERSION,REPO,parseVersion,compareVersions,latestRelease};
async function checkUpdates(fetchImpl=fetch){try{const response=await fetchImpl(`https://api.github.com/repos/${REPO}/releases?per_page=20`,{headers:{'User-Agent':'3wa-3dviewer','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('GitHub HTTP '+response.status);return latestRelease(await response.json());}catch(e){return {error:'無法檢查更新：'+e.message+'。離線模型瀏覽不受影響。'};}}
module.exports.checkUpdates=checkUpdates;
