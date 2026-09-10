import test from 'node:test';import assert from 'node:assert/strict';
import {resolveEntry} from '../public/entry.js';import {playerCsp,workspaceCsp} from '../src/security-headers.js';
test('share entry sends no owner-only request and preserves scoped viewer token',async()=>{
 const forbidden=()=>assert.fail('Shared viewers must not call owner APIs');
 const entry=await resolveEntry(new URL('https://example.com/watch/v_fixture#share=opaque&t=12'),{api:forbidden,op:forbidden});
 assert.deepEqual(entry,{kind:'shared',videoId:'v_fixture',shareToken:'opaque',start:12});
 await assert.rejects(()=>resolveEntry(new URL('https://example.com/watch/v_fixture#share='),{api:forbidden,op:forbidden}),/Invalid shared/);
});
test('private video and library entries require an accessible workspace',async()=>{
 const calls=[],api=async p=>{calls.push(p);return {tenants:[{id:'t_workspace'}]};},op=async(n,b)=>{calls.push(n);return {id:b.videoId};};
 assert.deepEqual(await resolveEntry(new URL('https://example.com/watch/v_fixture'),{api,op}),{kind:'video',workspace:'t_workspace',video:{id:'v_fixture'}});assert.deepEqual(calls,['/api/me','video_get']);
 assert.equal((await resolveEntry(new URL('https://example.com/'),{api,op})).kind,'library');
 await assert.rejects(()=>resolveEntry(new URL('https://example.com/'),{api:async()=>({tenants:[]}),op}),/no accessible workspace/);
});
test('stored-video CSP supports HLS workers without obsolete live-service permissions',()=>{
 for(const policy of [playerCsp(),workspaceCsp()]){assert.match(policy,/worker-src 'self' blob:/);assert.doesNotMatch(policy,/cloudflarestream/);assert.match(policy,/object-src 'none'/);}
 assert.match(workspaceCsp(),/frame-ancestors 'none'/);assert.match(playerCsp(['https://example.com']),/frame-ancestors 'self' https:\/\/example.com/);
});
