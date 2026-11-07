'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
let n = 0;
function check(name, run) { run(); n++; console.log('PASS ' + name); }
async function checkAsync(name, run) { await run(); n++; console.log('PASS ' + name); }

async function main() {
    const scripts = [];
    function visit(dir) {
        for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            const file = path.posix.join(dir, e.name);
            if (e.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) visit(file);
            else if (e.isFile() && file.endsWith('.js')) scripts.push(file);
        }
    }
    visit('.');
    for (const file of scripts) check('syntax ' + file, () => new vm.Script(read(file), { filename: file }));
    const app = read('app.js'), mobile = read('mobile/mobile.html'), html = read('index.html'), sw = read('sw.js');
    const data = read('data.js'), i18n = read('i18n.js'), manifest = read('manifest.js');
    check('service worker versions match', () => {
        assert.ok(sw.includes("PEGASUS_STORAGE_VERSION = '310'"));
        for (const content of [html, mobile, app]) assert.ok(content.includes('v=3.36.310'));
    });
    check('safe desktop restore never clears all site storage', () => {
        assert.ok(!read('backup.js').includes('localStorage.clear()'));
        assert.ok(read('backup.js').includes('previousValues'));
    });
    check('legacy mobile restore delegates to safe merge', () => {
        const legacy = mobile.slice(mobile.indexOf('function importData(event)'), mobile.indexOf('(async function boot()'));
        assert.ok(legacy.includes('PegasusMobileDataManager.restoreLocal(event)'));
        assert.ok(!legacy.includes('localStorage.clear()'));
    });
    check('PWA rejects incomplete permanent downloads', () => {
        assert.ok(sw.includes('if (skipped === 0)'));
        assert.ok(sw.includes('status: skipped ?'));
        assert.ok(sw.includes('pruneRedundantPegasusCaches'));
    });
    const mapPart = data.slice(data.indexOf('window.videoMap = {'),data.indexOf('};',data.indexOf('window.videoMap = {')));
    const pairs = [...mapPart.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)];
    const exSection = data.slice(data.indexOf('window.exercisesDB = ['),data.indexOf('];',data.indexOf('window.exercisesDB = [')));
    const names = [...exSection.matchAll(/\bname:\s*"([^"]+)"/g)].map(x=>x[1]);
    check('all exercise videos exist',()=>{
        assert.equal(names.length,24);
        for(const [_,name,asset] of pairs)assert.ok(fs.existsSync(path.join(ROOT,'videos',asset+'.mp4')),name+': '+asset);
        assert.equal(pairs.length,24);
    });
    const pairSection = i18n.slice(i18n.indexOf('const exercisePairs = ['),i18n.indexOf('];',i18n.indexOf('const exercisePairs = [')));
    const translated = [...pairSection.matchAll(/\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/g)].map(x=>x[2]);
    check('all exercises have EN/GR translation',()=>{for(const name of names)assert.ok(translated.includes(name),name)});
    const fnStart = app.indexOf('function computePegasusElapsedTick(');
    const fnEnd = app.indexOf('\nfunction runPhase()',fnStart);
    const elapsed = vm.runInNewContext(app.slice(fnStart,fnEnd)+'\ncomputePegasusElapsedTick');
    check('monotonic timer holds fractional seconds',()=>{
        assert.deepEqual(JSON.parse(JSON.stringify(elapsed(1000,1500,1,0,45))),{advancedSeconds:0,carrySeconds:0.5});
        assert.deepEqual(JSON.parse(JSON.stringify(elapsed(1500,2000,1,0.5,45))),{advancedSeconds:1,carrySeconds:0});
    });
    check('timer catches up without completing extra phases',()=>{
        assert.equal(elapsed(0,12000,1,0,45).advancedSeconds,12);
        assert.equal(elapsed(0,120000,1,0,45).advancedSeconds,45);
        assert.equal(elapsed(0,110,10,0,45).advancedSeconds,1);
        assert.equal(elapsed(1000,100,1,0,45).advancedSeconds,0);
    });
    const weekStart=manifest.indexOf('window.PegasusWeekClock = Object.freeze(');
    const weekEnd=manifest.indexOf('/* Shared weekly progress rollover',weekStart);
    const clockWindow={};
    vm.runInNewContext(manifest.slice(weekStart,weekEnd),{window:clockWindow,Intl,Date});
    const date=iso=>new Date(iso);
    check('Greek DST Sunday-to-Monday rollover',()=>{
        assert.equal(clockWindow.PegasusWeekClock.dateKey(date('2026-10-25T21:59:59Z')),'2026-10-25');
        assert.equal(clockWindow.PegasusWeekClock.dateKey(date('2026-10-25T22:00:00Z')),'2026-10-26');
        assert.equal(clockWindow.PegasusWeekClock.weekKey(date('2026-10-25T22:00:00Z')),'2026-10-26');
    });
    function restoreEnv(initial={},failedKey=null) {
        const store=new Map(Object.entries(initial));let filePromise=null,downloadClicks=0,reloads=0,failOnce=true;
        const storage={
            get length(){return store.size;},key(i){return [...store.keys()][i]??null;},
            getItem(k){return store.has(k)?store.get(k):null;},
            setItem(k,v){if(k===failedKey&&failOnce){failOnce=false;throw new Error('Simulated QuotaExceededError');}store.set(k,String(v));},
            removeItem(k){store.delete(k);}
        };
        const win={PegasusManifest:{workout:{}},location:{reload(){reloads++;}}};
        const doc={body:{appendChild(){}},createElement(){return {click(){downloadClicks++;},remove(){}}}};
        class FileReader {readAsText(file){filePromise=Promise.resolve(this.onload({target:{result:file.text}}));}}
        const sandbox={
            window:win,localStorage:storage,document:doc,FileReader,indexedDB:{},
            Blob,URL:{createObjectURL(){return 'blob:mock';},revokeObjectURL(){}},
            confirm:()=>true,alert(){},setTimeout:()=>{},console:{log(){},warn(){},error(){}},
            Date,JSON,Object,Map
        };
        vm.runInNewContext(read('backup.js'),sandbox);
        return {store,win,get clicks(){return downloadClicks;},get reloads(){return reloads;},
            async restore(value){
                win.importPegasusData({target:{files:[{size:200,text:JSON.stringify(value)}]}});
                await filePromise;
            }
        };
    }
    await checkAsync('valid backup merges without erasing unrelated data',async()=>{
        const ctx=restoreEnv({pegasus_weight:'74',pegasus_weekly_history:'keep',other_app:'unchanged'});
        await ctx.restore({localStorage:{pegasus_weight:'80',pegasus_rest_time:'90'}});
        assert.equal(ctx.store.get('pegasus_weight'),'80');
        assert.equal(ctx.store.get('pegasus_weekly_history'),'keep');
        assert.equal(ctx.store.get('other_app'),'unchanged');
        assert.equal(ctx.clicks,1);assert.equal(ctx.reloads,1);
    });
    await checkAsync('failed backup write rolls back all touched keys',async()=>{
        const ctx=restoreEnv({pegasus_weight:'74',pegasus_weekly_history:'keep',other_app:'unchanged'},'pegasus_rest_time');
        await ctx.restore({localStorage:{pegasus_weight:'80',pegasus_rest_time:'90'}});
        assert.equal(ctx.store.get('pegasus_weight'),'74');
        assert.equal(ctx.store.has('pegasus_rest_time'),false);
        assert.equal(ctx.store.get('pegasus_weekly_history'),'keep');
        assert.equal(ctx.store.get('other_app'),'unchanged');
        assert.equal(ctx.reloads,0);
    });
    await checkAsync('invalid backup cannot touch existing data',async()=>{
        const ctx=restoreEnv({pegasus_weight:'74'});
        await ctx.restore({localStorage:{arbitrary_key:'123'}});
        assert.equal(ctx.store.get('pegasus_weight'),'74');
        assert.equal(ctx.clicks,0);assert.equal(ctx.reloads,0);
    });
    check('existing gallery photos are never overwritten during restore', () => {
        const restore=read('backup.js');
        assert.ok(restore.includes('photos.get(photo.id)'));
        assert.ok(restore.includes('photos.add(photo)'));
        assert.ok(!restore.includes('photos.put(photo)'));
        assert.ok(!restore.includes('indexedDB.deleteDatabase('));
    });
    check('loader marks offline ready only when all assets succeeded', () => {
        assert.ok(app.includes("readyKey: 'pegasus_permanent_assets_ready_v310'"));
        assert.ok(app.includes('const offlineVerified = this.total > 0 && this.ok >= this.total && this.skipped === 0'));
        assert.ok(app.includes("marker.skipped > 0 || marker.ok < marker.total"));
    });
    check('set counters are capped and workout finish cannot run twice',()=>{
        assert.ok(app.includes('window.__pegasusFinishingSession'));
        assert.ok(app.includes('Math.min(maxSets, previousDone + 1)'));
        assert.ok(app.includes('if (done > previousDone)'));
    });
    await checkAsync('network still works when Cache Storage rejects',async()=>{
        const handlers={};
        const ctx={
            URL,Request,Response,Headers,Blob,
            console:{warn(){},log(){}},
            self:{location:{origin:'https://example.test',href:'https://example.test/pegasus/sw.js'},addEventListener(type,fn){handlers[type]=fn;},clients:{async matchAll(){return[];}}},
            caches:{async open(){throw new Error('Cache unavailable')},async keys(){return[];}},
            fetch:async()=>new Response('live-file',{status:200,headers:{'Content-Type':'application/javascript'}})
        };
        vm.createContext(ctx);vm.runInContext(sw,ctx);
        let result=null;
        handlers.fetch({
            request:new Request('https://example.test/pegasus/app.js'),
            respondWith(promise){result=promise;},
            waitUntil(){}
        });
        assert.ok(result,'SW must intercept the request');
        const response=await result;
        assert.equal(response.status,200);
        assert.equal(await response.text(),'live-file');
    });
    check('close-grip uses its dedicated video with a tested fallback', () => {
        assert.ok(mapPart.includes('"Lat Pulldowns Close": "latpulldownsclose"'));
        assert.ok(app.includes('function fallbackPegasusCloseVideo('));
        assert.ok(app.includes('monitorPegasusCloseVideo(vid, newSrc, label)'));
        assert.ok(app.includes("const fallback = 'videos/latpulldowns.mp4'"));
    });
    check('close-grip fallback is activated only if decoding fails or times out', () => {
        const start=app.indexOf('function getPegasusPlayableVideoSrc(');
        const end=app.indexOf('function loadPegasusVideoCandidate(', start);
        assert.ok(start>=0 && end>start);
        const timers=[];
        const win={};
        const ctx={
            window:win,
            console:{warn(){}},
            normalizePegasusVideoSrc:s=>s,
            stopPegasusVideoWaiter(){},
            markPegasusVideoActuallyReady(){},
            setTimeout:fn=>{timers.push(fn);return timers.length;}
        };
        vm.createContext(ctx);
        vm.runInContext(app.slice(start,end),ctx);
        function fakeVideo(readyState,error){
            return {
                src:'videos/latpulldownsclose.mp4',
                readyState,error,
                getAttribute(){return this.src;},
                pause(){},
                load(){this.loads=(this.loads||0)+1},
                play(){return Promise.resolve();},
                addEventListener(){}
            };
        }
        const label={style:{},textContent:''};
        const good=fakeVideo(3,null);
        ctx.monitorPegasusCloseVideo(good,good.src,label);
        timers.pop()();
        assert.equal(good.src,'videos/latpulldownsclose.mp4');
        const bad=fakeVideo(0,{code:4});
        ctx.monitorPegasusCloseVideo(bad,bad.src,label);
        timers.pop()();
        assert.equal(bad.src,'videos/latpulldowns.mp4');
        assert.equal(win.__pegasusCloseVideoUnavailable,true);
        assert.equal(ctx.getPegasusPlayableVideoSrc('Lat Pulldowns Close','videos/latpulldownsclose.mp4'),'videos/latpulldowns.mp4');
        assert.equal(ctx.getPegasusPlayableVideoSrc('Lat Pulldowns','videos/latpulldowns.mp4'),'videos/latpulldowns.mp4');
        assert.equal(bad.loads,1);
    });
    check('malformed browser JSON does not crash or silently erase the original value', () => {
        const start=manifest.indexOf('window.PegasusSafeStorage =');
        const end=manifest.indexOf('window.PegasusManifest =',start);
        assert.ok(start>=0&&end>start);
        const raw=new Map([['pegasus_daily_progress','{malformed']]);
        const ctx={
            window:{},console:{error(){},warn(){}},
            localStorage:{getItem:k=>raw.get(k)??null,setItem(k,v){raw.set(k,String(v))}}
        };
        vm.createContext(ctx);
        vm.runInContext(manifest.slice(start,end),ctx);
        const saved=ctx.window.PegasusSafeStorage.readJSON('pegasus_daily_progress',{});
        assert.equal(typeof saved,'object');
        assert.equal(Object.keys(saved).length,0);
        assert.equal(raw.get('pegasus_daily_progress'),'{malformed');
    });
    check('storage quota failures warn once and leave old data intact', () => {
        const start=manifest.indexOf('window.PegasusSafeStorage =');
        const end=manifest.indexOf('window.PegasusManifest =',start);
        let warnings=0, errors=0;
        const ctx={
            window:{alert(){warnings++}},
            console:{error(){errors++},warn(){}},
            localStorage:{getItem:()=>null,setItem(){throw new Error('QuotaExceededError')}}
        };
        vm.createContext(ctx);
        vm.runInContext(manifest.slice(start,end),ctx);
        assert.equal(ctx.window.PegasusSafeStorage.write('pegasus_weight','80',true),false);
        assert.equal(ctx.window.PegasusSafeStorage.write('pegasus_weight','80',true),false);
        assert.equal(warnings,1);
        assert.ok(errors>=2);
    });
    check('diagnostic logging cannot recursively crash when storage is full', () => {
        const start=app.indexOf('window.pegasusLogs =');
        const end=app.indexOf("window.addEventListener('error'",start);
        assert.ok(start>=0 && end>start);
        const messages=[];
        const mockConsole={error(...args){messages.push(args)},warn(...args){messages.push(args)}};
        const ctx={
            window:{PegasusSafeStorage:{readJSON:()=>[]}},
            console:mockConsole,
            localStorage:{setItem(){throw new Error('QuotaExceededError')}},
            P_M:{system:{}},Date
        };
        vm.createContext(ctx);
        vm.runInContext(app.slice(start,end),ctx);
        assert.doesNotThrow(()=>vm.runInContext("console.error('broken');console.warn('error')",ctx));
        assert.equal(messages.length,2);
    });
    await checkAsync('offline weather service cannot interrupt PEGASUS',async()=>{
        const weather=read('weather.js');
        const memory=new Map([['pegasus_weather_code','61']]);
        const ctx={
            window:{PegasusSafeStorage:{write(){return true;}}},
            localStorage:{getItem:k=>memory.get(k)||null},
            document:{addEventListener(){},querySelector:()=>({textContent:'',innerText:''})},
            console:{warn(){},log(){}},
            fetch:async()=>{throw new Error('Network unavailable')},
            Date,AbortSignal
        };
        vm.createContext(ctx);vm.runInContext(weather,ctx);
        await ctx.window.updateWeatherUI();
        assert.equal(memory.get('pegasus_weather_code'),'61');
        assert.equal(ctx.window.isRaining(),true);
    });
    check('optional reporting failure does not prevent workout completion UI',()=>{
        assert.ok(app.includes("console.error('PEGASUS: optional reporting failed"));
        const reporting=read('reporting.js');
        assert.ok(reporting.includes("PEGASUS EMAIL: storage unavailable"));
        assert.ok(reporting.includes("PEGASUS EMAIL: EmailJS did not load"));
    });
    // Evaluate SW in a mock service worker, without network or the user's browser data.
    await checkAsync('PWA failed downloads are not marked complete',async()=>{
        const cached=new Map();
        const cache={async match(r){return cached.get(r.url)||null;},async put(r,response){cached.set(r.url,response);},async keys(){return [...cached.keys()].map(url=>new Request(url));}};
        const calls=[];
        const context={
            URL,Request,Response,Headers,Blob,console:{warn(){},log(){}},
            self:{location:{origin:'https://example.test',href:'https://example.test/pegasus/sw.js'},addEventListener(){},clients:{async matchAll(){return[];}}},
            caches:{async open(){return cache;},async keys(){return ['pegasus-permanent-local-v310'];},async delete(){}},
            fetch:async()=>{throw new Error('No external network')}
        };
        vm.createContext(context);vm.runInContext(sw,context);
        vm.runInContext("cacheOnePermanentAsset=async()=>({ok:false,skipped:true,size:0});",context);
        await vm.runInContext("runPermanentLocalDownload()",context);
        const marked=[...cached.keys()].some(x=>x.includes('__pegasus_permanent_cache_meta__'));
        assert.equal(marked,false,'Skipped assets must not report offline-ready metadata');
        vm.runInContext("cacheOnePermanentAsset=async()=>({ok:true,cached:true,size:0});",context);
        await vm.runInContext("runPermanentLocalDownload()",context);
        assert.equal([...cached.keys()].some(x=>x.includes('__pegasus_permanent_cache_meta__')),true);
    });
    console.log(n+' safety regression checks passed');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
