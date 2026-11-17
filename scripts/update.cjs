// Run on your own PC (Windows: UPDATE.cmd). Deploys to the existing Cloudflare Worker,
// keeping the saved NOTION_TOKEN and WIDGET_SECRET. Then writes the app address.
const {spawn}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');process.chdir(root);
const npx=process.platform==='win32'?'npx.cmd':'npx',node=process.execPath;
function run(cmd,args){return new Promise((res,rej)=>{let out='';const c=spawn(cmd,args,{stdio:['inherit','pipe','pipe'],shell:process.platform==='win32'});c.stdout.on('data',b=>{out+=b;process.stdout.write(b)});c.stderr.on('data',b=>{out+=b;process.stderr.write(b)});c.on('error',rej);c.on('exit',code=>code===0?res(out):rej(Error('작업이 완료되지 않았어요. 위 메시지를 확인해 주세요.')))})}
function findKey(){
  for(const dir of [root,process.env.BUDGET_WIDGET_DIR].filter(Boolean)){
    const s=path.join(dir,'.widget-secret');if(fs.existsSync(s))return fs.readFileSync(s,'utf8').trim();
    for(const n of ['노션용-주소.txt','통합가계부-주소.txt']){const f=path.join(dir,n);if(fs.existsSync(f)){const m=fs.readFileSync(f,'utf8').match(/#k=([A-Za-z0-9_-]+)/);if(m)return m[1]}}
  }
  return '';
}
(async()=>{
  console.log('가계부 앱과 노션 위젯을 함께 배포합니다. 기존 데이터·노션 연결·접근키는 유지돼요.\n');
  await run(node,['scripts/build.mjs']);
  const out=await run(npx,['--yes','wrangler','deploy']);
  const origin=out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
  if(!origin){console.log('\n배포는 끝났지만 주소를 찾지 못했어요. Cloudflare 대시보드에서 Worker 주소를 확인한 뒤 끝에 /app/ 을 붙여 열어 주세요.');return}
  const key=findKey();
  const lines=['가계부 앱 주소 (휴대폰에서 열기): '+origin+'/app/'+(key?'#k='+key:''),'',key?'처음 한 번 이 주소로 열면 접근키가 휴대폰에 저장돼요. 다른 사람에게 공유하지 마세요.':'접근키는 기존 설치 폴더의 노션용-주소.txt에서 #k= 뒤 값을 확인해 앱에 입력해 주세요.'];
  fs.writeFileSync('앱-주소.txt',lines.join('\n')+'\n',{mode:0o600});
  console.log('\n완료! 앱-주소.txt 파일에 휴대폰용 주소를 저장했어요.');
})().catch(e=>{console.error('\n'+e.message);process.exitCode=1});
