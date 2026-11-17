export function fixedForMonth(revisions, month) {
 const latest=new Map();
 for(const r of revisions){if(r.from<=month&&(!latest.has(r.key)||latest.get(r.key).from<r.from))latest.set(r.key,r)}
 return [...latest.values()].filter(r=>!r.stopped);
}
export function fixedRows(revisions,month){return fixedForMonth(revisions,month).map(r=>({...r,id:'fixed:'+r.key+':'+month,fixedKey:r.key,date:month+'-'+String(Math.min(r.day,new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).getUTCDate())).padStart(2,'0')}))}
export function recordWindow(end){const d=new Date(end+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-2);return {start:d.toISOString().slice(0,10),end}}
