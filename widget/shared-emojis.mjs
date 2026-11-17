// Shared across widgets; adapter must be server-only and authenticated.
export const EMOJI_SOURCE='548256d8-4b1c-48ff-9e81-150a85843c0f';
export const GROUP_NAMES={budget:'가계부',habits:'습관',common:'공통'};
const rt=s=>[{type:'text',text:{content:s}}];
const text=v=>(v||[]).map(x=>x.plain_text??x.text?.content??'').join('');
export async function readEmojiGroups(adapter){const rows=await adapter.query(EMOJI_SOURCE);const groups={};for(const row of rows){const id=text(row.properties['이모지 ID']?.title);if(!id)continue;groups[id]=(row.properties['분류']?.multi_select||[]).map(x=>Object.keys(GROUP_NAMES).find(k=>GROUP_NAMES[k]===x.name)).filter(Boolean)}return groups}
export async function saveEmojiGroups(adapter,id,groups){if(typeof id!=='string'||!(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i).test(id))throw Error('이모지 ID를 확인해 주세요.');if(!Array.isArray(groups)||groups.some(g=>!Object.hasOwn(GROUP_NAMES,g)))throw Error('분류를 확인해 주세요.');const rows=await adapter.query(EMOJI_SOURCE,{property:'이모지 ID',title:{equals:id}});const properties={'이모지 ID':{title:rt(id)},'분류':{multi_select:[...new Set(groups)].map(k=>({name:GROUP_NAMES[k]}))}};return rows.length?adapter.notion('pages/'+rows[0].id,'PATCH',{properties}):adapter.notion('pages','POST',{parent:{type:'data_source_id',data_source_id:EMOJI_SOURCE},properties})}
