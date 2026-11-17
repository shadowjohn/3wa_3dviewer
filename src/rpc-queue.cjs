// One bounded queue per client; a closed client never starts more work.
function createQueue(run,{limit=8,onRejected=()=>{},onCancel=()=>{}}={}){
 let closed=false,tail=Promise.resolve();const entries=new Map();
 return {
 enqueue(m){if(closed)return false;if(entries.has(m.id)||entries.size>=limit){onRejected(m,'Queue full or duplicate request id');return false;}const e={cancelled:false};entries.set(m.id,e);tail=tail.then(async()=>{if(closed)return;if(e.cancelled){onRejected(m,'Request cancelled before execution');return;}await run(m,()=>closed||e.cancelled);}).catch(err=>{if(!closed)onRejected(m,String(err.message||err));}).finally(()=>entries.delete(m.id));return true;},
 cancel(id){const e=entries.get(id);if(e){e.cancelled=true;onCancel(id);}},
 close(){closed=true;for(const [id,e] of entries){e.cancelled=true;onCancel(id);}},
 settled(){return tail;}
 };
}
module.exports={createQueue};
