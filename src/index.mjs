// Cloudflare Worker entry: serves the mobile app (PWA) under /app/ and keeps the
// existing Notion embed widgets and /api/* routes exactly as they were.
import {handle} from '../widget/server.mjs';
import {WIDGET_HTML,APP_HTML,MANIFEST,SW,ASSETS} from '../build/generated.mjs';

const base={'referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const APP_CSP="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'self'; img-src 'self' https: data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const decoded=new Map();
function asset(path){
  if(!decoded.has(path)){const s=ASSETS[path];if(!s)return null;decoded.set(path,Uint8Array.from(atob(s),c=>c.charCodeAt(0)))}
  return decoded.get(path);
}

export async function route(request,env){
  const u=new URL(request.url);
  if(request.method==='GET'||request.method==='HEAD'){
    if(u.pathname==='/app')return Response.redirect(u.origin+'/app/'+u.search+u.hash,301);
    if(u.pathname==='/app/')return new Response(APP_HTML,{headers:{...base,'content-type':'text/html; charset=utf-8','cache-control':'no-cache','content-security-policy':APP_CSP}});
    if(u.pathname==='/app/manifest.webmanifest')return new Response(MANIFEST,{headers:{...base,'content-type':'application/manifest+json; charset=utf-8','cache-control':'no-cache'}});
    if(u.pathname==='/app/sw.js')return new Response(SW,{headers:{...base,'content-type':'text/javascript; charset=utf-8','cache-control':'no-cache'}});
    if(u.pathname.startsWith('/app/assets/')){const body=asset(u.pathname);if(body)return new Response(body,{headers:{...base,'content-type':'image/png','cache-control':'public, max-age=86400'}})}
  }
  return handle(request,env,WIDGET_HTML);
}
export default {fetch:route};
