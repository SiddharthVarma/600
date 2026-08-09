const {useState,useEffect,useRef}=React;
const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
const games=[['thermal','THERMAL ROUTING','Valve sequencing'],['power','POWER BUS','Wire matching'],['solar','SOLAR ALIGNMENT','Point at the sun'],['contact','MISSED CONTACT','Hunt the signal peak'],['comms','COMMS ALIGNMENT','Tune the carrier'],['process','PROCESS FAULT','Restart sequence'],['orbit','ORBITAL BURN','Plot a transfer burn'],['sensor','SENSOR FAULT','Find the outlier'],['attitude','ATTITUDE DRIFT','Stabilize pointing'],['battery','BATTERY CELLS','Balance the pack'],['impact','MODULE IMPACT','Isolate the breach'],['radiation','RADIATION EVENT','Wait it out']];
function Frame({type,setType,children}){const embedded=Boolean(new URLSearchParams(location.search).get('type'));return <div className="app"><header className="top"><span className="brand">SIX HUNDRED / REPAIR LAB</span><span className="eyebrow">SAT 421 · MANUAL OVERRIDE</span></header><div className={'layout '+(embedded?'embedded':'')} style={embedded?{display:'block',marginTop:0}:{}}>{!embedded&&<nav className="menu">{games.map(([id,name])=><button key={id} className={type===id?'active':''} onClick={()=>setType(id)}>{name}</button>)}</nav>}<main className="board" style={embedded?{minHeight:'100%',border:0}:{}}>{children}</main></div></div>}
function Header({title,sub}){return <><div className="eyebrow">Critical subsystem interaction</div><h1>{title}</h1><div className="signal">{sub}</div></>}
function Result({ok,children}){const [sent,setSent]=useState(false);const finish=()=>{if(!sent&&window.parent!==window){setSent(true);setTimeout(()=>window.parent.postMessage({type:'repair-complete'},'*'),1200)}};return children&&<div className={ok?'success':'failure'}>{sent?'SUCCESSFUL EXECUTION':children}{ok&&<div className="actions"><button className="action" onClick={finish} disabled={sent}>{sent?'SUCCESSFUL EXECUTION':'EXECUTE'}</button></div>}</div>}
function Thermal(){const [routeValve]=useState(()=>Math.random()<.5?'VALVE A':'VALVE B'),[path,setPath]=useState([]),[dragging,setDragging]=useState(false),[error,setError]=useState('');const nodes={CORE:[40,110],PUMP:[105,110],'VALVE A':[170,52],'VALVE B':[170,168],RADIATOR:[258,110]},target=['CORE','PUMP',routeValve,'RADIATOR'];const temp=78-path.length*8,pressure=42+path.length*16,ok=path.length===4;const follow=e=>{if(!dragging||ok)return;const box=e.currentTarget.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*300,y=(e.clientY-box.top)/box.height*220;const node=Object.keys(nodes).find(n=>Math.hypot(nodes[n][0]-x,nodes[n][1]-y)<23);if(!node||path.includes(node))return;if(node===target[path.length]){setPath(p=>[...p,node]);setError('')}else{setPath([]);setDragging(false);setError('FLOW LOST · COOLANT ENTERED HOT BYPASS')}};const start=e=>{setPath([]);setError('');setDragging(true);e.currentTarget.setPointerCapture?.(e.pointerId);const box=e.currentTarget.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*300,y=(e.clientY-box.top)/box.height*220;if(Math.hypot(40-x,110-y)<28)setPath(['CORE']);else{setDragging(false);setError('START AT THE HOT CORE')}};const line=(a,b,on)=>{const [x1,y1]=nodes[a],[x2,y2]=nodes[b];return <line key={a+b} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on?'#c9ff4d':'#34403a'} strokeWidth={on?7:4} strokeLinecap="round"/>};return <><Header title="THERMAL ROUTING" sub={`CORE ${temp}°C · COOLANT ${pressure} kPa`}/><p className="instructions">Hold and drag from the hot core through the pump, the safe valve, and into the radiator. The red route is a hot bypass.</p><svg viewBox="0 0 300 220" width="100%" style={{maxWidth:650,display:'block',margin:'28px 0',background:'#0c1210',border:'1px solid #34403a',cursor:dragging?'grabbing':'crosshair',touchAction:'none'}} onPointerDown={start} onPointerMove={follow} onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)}>{line('CORE','PUMP',path.includes('PUMP'))}{line('PUMP','VALVE A',path.includes('VALVE A'))}{line('PUMP','VALVE B',path.includes('VALVE B'))}{line('VALVE A','RADIATOR',path.includes('VALVE A')&&path.includes('RADIATOR'))}{line('VALVE B','RADIATOR',path.includes('VALVE B')&&path.includes('RADIATOR'))}{Object.entries(nodes).map(([n,[x,y]])=><g key={n}><circle cx={x} cy={y} r="20" fill={n===routeValve?'#172714':n.startsWith('VALVE')?'#351518':'#13201b'} stroke={path.includes(n)?'#c9ff4d':n===routeValve?'#c9ff4d':n.startsWith('VALVE')?'#ff5964':'#738079'} strokeWidth="3"/><text x={x} y={y+4} textAnchor="middle" fill="#eef4eb" fontSize="8">{n==='RADIATOR'?'RADIATOR':n}</text></g>)}<text x="150" y="205" textAnchor="middle" fill={dragging?'#c9ff4d':'#89948d'} fontSize="10">{dragging?'DRAGGING COOLANT FLOW':'HOLD ON CORE · TRACE THE SAFE ROUTE'}</text></svg><div className="readout" style={{color:temp>70?'var(--red)':temp>55?'var(--yellow)':'var(--green)'}}>CORE {temp}°C · PRESSURE {pressure} kPa</div><button className="action" onClick={()=>{setPath([]);setError('')}}>RESET ROUTE</button><Result ok={ok}>{ok?'THERMAL LOOP STABLE · COOLANT FLOW CONFIRMED':error||'Drag a continuous coolant path through the system.'}</Result></>}
function Power(){const [left,setLeft]=useState(null),[pairs,setPairs]=useState([]),[leftColors]=useState(()=>shuffle(['red','blue','green'])),[rightColors]=useState(()=>shuffle(['red','blue','green']));const colors={red:'#ff5964',blue:'#55b6ff',green:'#c9ff4d'},ys=[60,150,240];const connect=(side,c)=>{if(pairs.includes(c))return;if(!left)setLeft({side,c});else if(left.side!==side&&left.c===c){setPairs(p=>[...p,c]);setLeft(null)}else setLeft({side,c})};const socket=(side,c,i)=>{const x=side==='bus'?24:476,y=ys[i],chosen=left?.side===side&&left.c===c,done=pairs.includes(c);return <g key={side+c} onClick={()=>connect(side,c)} style={{cursor:'pointer'}}><rect x={x} y={y} width="100" height="48" rx="4" fill={chosen?'#f4f7ef':'#101614'} stroke={chosen?'#f4f7ef':colors[c]} strokeWidth="3"/><circle cx={side==='bus'?112:488} cy={y+24} r="6" fill={colors[c]}/><text x={x+50} y={y+20} textAnchor="middle" fill={chosen?'#070809':colors[c]} fontSize="12">{side.toUpperCase()}</text><text x={x+50} y={y+35} textAnchor="middle" fill={chosen?'#070809':colors[c]} fontSize="11">{c.toUpperCase()}{done?' ✓':''}</text></g>};return <><Header title="POWER BUS" sub="VOLTAGE OSCILLATION · BACKUP BUS AVAILABLE"/><p className="instructions">Patch each colored power bus to its matching load. Cable routing is independent of terminal position.</p><svg viewBox="0 0 600 310" width="100%" style={{maxWidth:720,display:'block',margin:'26px 0',background:'#0c1210',border:'1px solid #34403a'}}>{pairs.map(c=>{const from=leftColors.indexOf(c),to=rightColors.indexOf(c),y1=ys[from]+24,y2=ys[to]+24;return <path key={c} d={`M 124 ${y1} C 240 ${y1}, 360 ${y2}, 476 ${y2}`} fill="none" stroke={colors[c]} strokeWidth="7" strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${colors[c]})`}}/>})}{leftColors.map((c,i)=>socket('bus',c,i))}{rightColors.map((c,i)=>socket('load',c,i))}<text x="300" y="295" textAnchor="middle" fill="#849089" fontSize="11">SELECT BUS SOCKET → MATCHING LOAD SOCKET</text></svg><Result ok={pairs.length===3}>{pairs.length===3?'POWER BUS BALANCED · 68% OUTPUT':'Select a colored bus socket, then its matching load socket.'}</Result></>}
function Solar(){
  const CHARGE_RATE=100/9,DRAIN_RATE=100/25,TOL=14,SUN_R=108,CX=150,CY=150;
  const ASSETS='600_solar_assets/';
  const [dir]=useState(()=>Math.random()<.5?1:-1);
  const [speed]=useState(()=>5+Math.random()*3);
  const [stars]=useState(()=>Array.from({length:40},()=>({x:Math.random()*300,y:Math.random()*300,r:Math.random()*1.2+.3,o:Math.random()*.6+.2})));
  const [angle,setAngle]=useState(()=>Math.random()*360);
  const angleRef=useRef(angle);
  const [sunAngle,setSunAngle]=useState(()=>Math.random()*360);
  const [charge,setCharge]=useState(0);
  const [done,setDone]=useState(false);

  const angDelta=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d};
  const polar=(deg,r)=>{const a=deg*Math.PI/180;return [CX+Math.cos(a)*r,CY-Math.sin(a)*r]};

  useEffect(()=>{
    if(done)return;
    let raf,lastTs,sunLocal=sunAngle;
    const step=ts=>{
      if(lastTs==null)lastTs=ts;
      const dt=Math.min(.1,(ts-lastTs)/1000);
      lastTs=ts;
      sunLocal=(sunLocal+dir*speed*dt+360)%360;
      const aligned=angDelta(angleRef.current,sunLocal)<=TOL;
      setSunAngle(sunLocal);
      setCharge(c=>Math.min(100,Math.max(0,c+(aligned?CHARGE_RATE:-DRAIN_RATE)*dt)));
      raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[done]);

  useEffect(()=>{if(charge>=100)setDone(true)},[charge]);

  useEffect(()=>{
    if(!done)return;
    if(window.parent!==window){const id=setTimeout(()=>window.parent.postMessage({type:'repair-complete'},'*'),1200);return()=>clearTimeout(id)}
  },[done]);

  const aligned=angDelta(angle,sunAngle)<=TOL;
  const [w1x,w1y]=polar(angle-TOL,135),[w2x,w2y]=polar(angle+TOL,135);
  const sector=`M ${CX} ${CY} L ${w1x} ${w1y} A 135 135 0 0 1 ${w2x} ${w2y} Z`;
  const [sx,sy]=polar(sunAngle,SUN_R);
  const SCID_W=150,SCID_H=SCID_W*342/520,SUN_W=70,SUN_H=SUN_W*345/520;

  return <>
    <Header title="SOLAR ALIGNMENT" sub="ARRAY OFFLINE · BATTERY DEPLETED"/>
    <p className="instructions">Steer the array to keep the sun inside the amber cone. The sun drifts in a slow orbit, so once you're locked on you'll need to keep nudging the slider to stay with it while the battery charges.</p>
    <div style={{display:'grid',placeItems:'center',margin:'24px 0'}}>
      <svg viewBox="0 0 300 300" width="320" height="320" style={{background:'radial-gradient(circle,#0e1614,#070809 70%)',border:'1px solid #34403a'}}>
        {stars.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o}/>)}
        <circle cx={CX} cy={CY} r={SUN_R} fill="none" stroke="#242c29" strokeDasharray="3 5"/>
        <path d={sector} fill={aligned?'rgba(201,255,77,.28)':'rgba(255,209,102,.14)'} stroke={aligned?'#c9ff4d':'#ffd166'} strokeWidth="2"/>
        <image href={ASSETS+'sun.png'} x={sx-SUN_W/2} y={sy-SUN_H/2} width={SUN_W} height={SUN_H} style={{filter:aligned?'brightness(1.35) drop-shadow(0 0 16px rgba(255,180,60,.7))':'none',transition:'filter .2s'}}/>
        <image href={ASSETS+'scid.png'} x={CX-SCID_W/2} y={CY-SCID_H/2} width={SCID_W} height={SCID_H} transform={`rotate(${90-angle} ${CX} ${CY})`}/>
        <text x="150" y="292" textAnchor="middle" fontSize="9" fill={aligned?'#c9ff4d':'#89948d'}>{done?'ARRAY CHARGED':aligned?'CHARGING · HOLD STEADY':'STEER INTO THE CONE'}</text>
      </svg>
    </div>
    <div className="readout" style={{color:aligned?'var(--green)':'var(--yellow)'}}>BATTERY {Math.round(charge)}% · ARRAY {Math.round(angle)}° · SUN {Math.round(sunAngle)}°</div>
    <input className="range" type="range" min="0" max="359" value={Math.round(angle)} onChange={e=>{const v=+e.target.value;angleRef.current=v;setAngle(v)}} disabled={done}/>
    <div className="bar"><i style={{width:`${charge}%`,background:aligned?'var(--green)':'var(--yellow)'}}/></div>
    <div className="legend"><span><i className="dot yellowbg"/>ALIGNMENT CONE ±{TOL}°</span><span><i className="dot green"/>CHARGING</span></div>
    {done?<div className="success">ARRAY CHARGED · BATTERY ONLINE</div>:null}
  </>;
}
function Contact(){
  const THRESH=88;
  const [seed]=useState(()=>({base:Math.random()*360,f1:.15+Math.random()*.1,f2:.26+Math.random()*.12,amp1:60+Math.random()*30,amp2:22+Math.random()*14,phase1:Math.random()*Math.PI*2,phase2:Math.random()*Math.PI*2}));
  const [angle,setAngle]=useState(()=>Math.random()*360);
  const angleRef=useRef(angle);
  const [strength,setStrength]=useState(0);
  const [locked,setLocked]=useState(false);
  const [message,setMessage]=useState('');

  const angDelta=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d};
  const targetAngle=ms=>{const s=ms/1000;return (seed.base+Math.sin(s*seed.f1+seed.phase1)*seed.amp1+Math.sin(s*seed.f2+seed.phase2)*seed.amp2+3600)%360};
  const signalAt=diff=>{const raw=Math.cos(diff*Math.PI/180);return raw>0?Math.pow(raw,4)*100:0};

  useEffect(()=>{
    if(locked)return;
    let raf,startTs;
    const step=ts=>{
      if(!startTs)startTs=ts;
      const elapsed=ts-startTs;
      const tgt=targetAngle(elapsed);
      const diff=angDelta(angleRef.current,tgt);
      setStrength(signalAt(diff));
      raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[locked]);

  useEffect(()=>{
    if(!locked)return;
    if(window.parent!==window){const id=setTimeout(()=>window.parent.postMessage({type:'repair-complete'},'*'),1200);return()=>clearTimeout(id)}
  },[locked]);

  const setAngleBoth=a=>{angleRef.current=a;setAngle(a);setMessage('')};
  const lockSignal=()=>{
    if(strength>=THRESH){setLocked(true);setMessage('')}
    else setMessage('SIGNAL TOO WEAK · KEEP TUNING');
  };

  const bars=[20,45,70,90];
  const ASSETS='600_satellite_game_assets/';
  const FRAME_DIR='600_gn_antenna_pixel_frames/';
  const FRAMES=[{file:'antenna_r01_f01.png',w:96,h:168},{file:'antenna_r01_f02.png',w:128,h:168},{file:'antenna_r01_f03.png',w:128,h:173},{file:'antenna_r01_f04.png',w:105,h:176},{file:'antenna_r01_f05.png',w:103,h:177},{file:'antenna_r01_f06.png',w:96,h:186},{file:'antenna_r01_f07.png',w:93,h:184},{file:'antenna_r01_f08.png',w:99,h:176},{file:'antenna_r01_f09.png',w:103,h:176},{file:'antenna_r01_f10.png',w:128,h:170},{file:'antenna_r01_f11.png',w:128,h:166},{file:'antenna_r01_f12.png',w:96,h:159}];
  const DISPLAY_H=170,GROUND_Y=232,CX=150;
  const frameIdx=Math.round(angle/30)%12;
  const fr=FRAMES[frameIdx];
  const dispW=DISPLAY_H*(fr.w/fr.h);
  const imgX=CX-dispW/2,imgY=GROUND_Y-DISPLAY_H;

  return <>
    <Header title="MISSED CONTACT" sub="RSSI -104 dBm · NO DIRECTIONAL LOCK"/>
    <p className="instructions">The satellite's bearing isn't shown — only signal strength. Sweep the dish and hill-climb toward the peak. The satellite keeps drifting, so once you're close you'll need to keep tracking it, not just point and let go.</p>
    <div style={{display:'grid',placeItems:'center',margin:'24px 0'}}>
      <svg viewBox="0 0 300 300" width="320" height="320" style={{background:'#0c1210',border:'1px solid #34403a'}}>
        <ellipse cx={CX} cy={GROUND_Y+6} rx="72" ry="10" fill="rgba(0,0,0,.35)"/>
        <image href={FRAME_DIR+fr.file} x={imgX} y={imgY} width={dispW} height={DISPLAY_H} style={{imageRendering:'pixelated'}}/>
        {locked&&<image href={ASSETS+'satellite_mid_elevation.png'} x="196" y="24" width="78" height={78*116/173} style={{imageRendering:'pixelated'}}/>}
        {bars.map((th,i)=><rect key={th} x={20+i*13} y={54-(10+i*7)} width="9" height={10+i*7} fill={strength>=th?'#c9ff4d':'#2a332f'} stroke="#1c2422" strokeWidth="1"/>)}
        <text x="150" y="292" textAnchor="middle" fontSize="9" fill={strength>=THRESH?'#c9ff4d':'#89948d'}>{locked?'DOWNLINK ESTABLISHED':strength>=THRESH?'SIGNAL PEAKED · LOCK IT IN':'SWEEP THE DISH · HILL-CLIMB THE SIGNAL'}</text>
      </svg>
    </div>
    <div className="readout" style={{color:strength>=THRESH?'var(--green)':strength>40?'var(--yellow)':'var(--red)'}}>SIGNAL {Math.round(strength)}% · BEARING {Math.round(angle)}°</div>
    <input className="range" type="range" min="0" max="359" value={Math.round(angle)} onChange={e=>setAngleBoth(+e.target.value)} disabled={locked}/>
    <div className="bar"><i style={{width:`${strength}%`,background:strength>=THRESH?'var(--green)':strength>40?'var(--yellow)':'var(--red)'}}/></div>
    <div className="actions"><button className="action" style={{borderColor:strength>=THRESH?'var(--green)':'#39453f',color:strength>=THRESH?'var(--green)':'#85908a'}} onClick={lockSignal} disabled={locked}>LOCK SIGNAL</button></div>
    <div className="legend"><span><i className="dot green"/>SIGNAL PEAK</span></div>
    {locked?<div className="success">DOWNLINK ESTABLISHED · TELEMETRY RECEIVED</div>:message?<div className="failure">{message}</div>:null}
  </>;
}
function Comms(){const [target]=useState(()=>55+Math.floor(Math.random()*35)),[f,setF]=useState(()=>target-18);const ok=Math.abs(f-target)<=3;return <><Header title="COMMS ALIGNMENT" sub="RSSI -96 dBm · CARRIER LOCK LOST"/><p className="instructions">Tune the carrier into the ground-station window. The target frequency is somewhere in the highlighted band.</p><div className="readout">{f}.0 MHz · TARGET {target}±3</div><input className="range" type="range" min="0" max="100" value={f} onChange={e=>setF(+e.target.value)}/><div className="bar"><i style={{width:`${f}%`,background:ok?'var(--green)':'var(--blue)'}}/></div><Result ok={ok}>{ok?'CARRIER LOCKED · CONTACT RESTORED':'Sweep the band until the carrier locks.'}</Result></>}
function Process(){const [processes]=useState(()=>shuffle(['PACKET RETRY','TELEMETRY CACHE','IMAGE PIPELINE','LOG AGGREGATOR','PAYLOAD INDEXER','MEMORY SCRUBBER'])),[leaks]=useState(()=>new Set(shuffle(['PACKET RETRY','TELEMETRY CACHE','IMAGE PIPELINE','LOG AGGREGATOR','PAYLOAD INDEXER','MEMORY SCRUBBER']).slice(0,3))),[warnings]=useState(()=>new Set([...leaks,processes.find(p=>!leaks.has(p))])),[stopped,setStopped]=useState([]);const correct=stopped.filter(p=>leaks.has(p)).length,wrong=stopped.length-correct,cpu=98-correct*12+wrong*6,rssi=82-wrong*12,ok=correct===3&&wrong===0&&cpu<70;const toggle=p=>setStopped(s=>s.includes(p)?s.filter(x=>x!==p):[...s,p]);return <><Header title="MEMORY LEAK" sub={`CPU ${cpu}% · RSSI ${rssi} dBm · ${correct}/3 LEAKS ISOLATED`}/><p className="instructions">Three subprocesses are leaking memory. Isolate the right combination until CPU falls below 70%. One warning is a decoy; stopping a healthy service raises CPU and reduces RSSI.</p><div className="pixel-grid">{processes.map(p=>{const off=stopped.includes(p),actual=leaks.has(p),suspect=warnings.has(p);return <button className={'node '+(off?(actual?'done':'fail'):'')} onClick={()=>toggle(p)} key={p}>{p}<br/><small>{off?(actual?'ISOLATED':'HEALTHY SERVICE OFFLINE'):(suspect?'ALLOC WARN · HIGH':'NOMINAL LOAD')}</small></button>})}</div><div className="bar"><i style={{width:`${cpu}%`,background:cpu<70?'var(--green)':'var(--red)'}}/></div><div className="readout" style={{color:cpu<70?'var(--green)':'var(--red)'}}>CPU {cpu}% · RSSI {rssi} dBm</div><div className="eyebrow">LIVE LOG</div><p className="instructions" style={{color:'#ff9d9d'}}>allocation spikes are correlated with packet retries · one warning is a false positive · healthy service shutdowns degrade downlink</p><Result ok={ok}>{ok?'LEAKS CONTAINED · CPU BELOW SAFE THRESHOLD':'Isolate three leaking services, and restore every healthy service.'}</Result></>}
function Orbit(){
  const cx=150,cy=150;
  const [cfg]=useState(()=>{
    const raiseMode=Math.random()<.5,r2=60+Math.random()*20,delta=20+Math.random()*12;
    const r1=raiseMode?Math.max(26,r2-delta):r2+delta;
    const startAngle=Math.random()*360,windowCenter=(startAngle+130+Math.random()*100)%360;
    return {raiseMode,r1,r2,minSafeR:40,radiusTol:9,startAngle,windowCenter,windowWidth:50};
  });
  const [stage,setStage]=useState('plot'); // plot -> approach -> coast -> success
  const [drag,setDrag]=useState(null),[locked,setLocked]=useState(null),[error,setError]=useState('');
  const [t,setT]=useState(0),[sweepT,setSweepT]=useState(0),[sweepDeg,setSweepDeg]=useState(0);

  const polar=(deg,r)=>{const a=deg*Math.PI/180;return [cx+Math.cos(a)*r,cy-Math.sin(a)*r]};
  const angDelta=(a,b)=>Math.abs(((a-b+540)%360)-180);
  const satStart=polar(cfg.startAngle,cfg.r1);
  const points=end=>{
    const [ex,ey]=polar(end.angle,end.dist);
    const da=((end.angle-cfg.startAngle+540)%360)-180,midAngle=cfg.startAngle+da/2;
    const midR=Math.max(20,Math.max(cfg.r1,end.dist)+(cfg.raiseMode?26:-16));
    const [mx,my]=polar(midAngle,midR);
    return [satStart,[mx,my],[ex,ey]];
  };
  const pathD=pts=>`M ${pts[0][0]} ${pts[0][1]} Q ${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}`;
  const bezierAt=(pts,p)=>{const x=(1-p)*(1-p)*pts[0][0]+2*(1-p)*p*pts[1][0]+p*p*pts[2][0],y=(1-p)*(1-p)*pts[0][1]+2*(1-p)*p*pts[1][1]+p*p*pts[2][1];return [x,y]};
  const toSvg=e=>{const box=e.currentTarget.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*300,y=(e.clientY-box.top)/box.height*300,dx=x-cx,dy=y-cy;return {x,y,dist:Math.hypot(dx,dy),angle:(Math.atan2(-dy,dx)*180/Math.PI+360)%360}};
  const evaluateMag=d=>{
    if(!d)return {valid:false,msg:''};
    if(d.dist<cfg.minSafeR)return {valid:false,msg:'DANGER · ATMOSPHERIC INTERFACE'};
    if(Math.abs(d.dist-cfg.r2)>cfg.radiusTol)return {valid:false,msg:d.dist>cfg.r2+cfg.radiusTol?'OVERSHOOT · BURN TOO HOT':'UNDERSHOOT · BURN TOO WEAK'};
    return {valid:true,msg:'BURN PLOTTED'};
  };

  const start=e=>{if(stage!=='plot'||locked)return;const p=toSvg(e);if(Math.hypot(satStart[0]-p.x,satStart[1]-p.y)>26){setError('GRAB THE SATELLITE TO BEGIN');return}e.currentTarget.setPointerCapture?.(e.pointerId);setError('');setDrag(p)};
  const move=e=>{if(!drag||stage!=='plot'||locked)return;setDrag(toSvg(e))};
  const release=()=>{if(!drag||stage!=='plot'||locked)return;const res=evaluateMag(drag);if(res.valid){setLocked(drag);setError('')}else setError(res.msg);setDrag(null)};

  useEffect(()=>{
    if(stage!=='approach')return;
    let raf,startTs;
    const step=ts=>{
      if(!startTs)startTs=ts;
      const p=Math.min(1,(ts-startTs)/1300);
      setT(p);
      if(p<1)raf=requestAnimationFrame(step);
      else{
        const raw=((cfg.windowCenter+cfg.windowWidth/2-locked.angle)+720)%360;
        setSweepDeg(raw<10?raw+360:raw);
        setSweepT(0);
        setStage('coast');
      }
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[stage]);

  useEffect(()=>{
    if(stage!=='coast')return;
    const duration=Math.max(1800,sweepDeg/18*1000);
    let raf,startTs;
    const step=ts=>{
      if(!startTs)startTs=ts;
      const p=Math.min(1,(ts-startTs)/duration);
      setSweepT(p);
      if(p<1)raf=requestAnimationFrame(step);
      else{setStage('plot');setLocked(null);setDrag(null);setT(0);setSweepT(0);setError('BURN WINDOW EXPIRED · REPLOT TRAJECTORY')}
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[stage,sweepDeg]);

  useEffect(()=>{
    if(stage!=='success')return;
    if(window.parent!==window){const id=setTimeout(()=>window.parent.postMessage({type:'repair-complete'},'*'),1200);return()=>clearTimeout(id)}
  },[stage]);

  const fireCircularization=()=>{
    if(!inWindow){setStage('plot');setLocked(null);setDrag(null);setT(0);setSweepT(0);setError('CIRCULARIZATION MISSED · TRAJECTORY DECAYED · REPLOT BURN');return}
    setStage('success');
  };

  const active=locked||drag;
  const evalNow=evaluateMag(drag);
  const pts=stage==='plot'&&active?points(active):null;
  const approachPts=locked?points(locked):null;
  const currentAngle=stage==='coast'&&locked?(locked.angle+sweepDeg*sweepT)%360:null;
  const inWindow=currentAngle!=null&&angDelta(currentAngle,cfg.windowCenter)<=cfg.windowWidth/2;
  const nearWindow=!inWindow&&currentAngle!=null&&angDelta(currentAngle,cfg.windowCenter)<=cfg.windowWidth/2+18;
  const trail=stage==='coast'&&locked?Array.from({length:25},(_,i)=>polar(locked.angle+sweepDeg*sweepT*i/24,cfg.r2)):[];
  const satNow=stage==='approach'&&approachPts?bezierAt(approachPts,t):stage==='coast'&&currentAngle!=null?polar(currentAngle,cfg.r2):stage==='success'?polar(cfg.windowCenter,cfg.r2):satStart;
  const arcPts=Array.from({length:9},(_,i)=>polar(cfg.windowCenter-cfg.windowWidth/2+cfg.windowWidth*i/8,cfg.r2));
  const sectorPath=`M ${cx} ${cy} L ${arcPts.map(p=>p.join(',')).join(' L ')} Z`;
  const [wlx,wly]=polar(cfg.windowCenter,cfg.r2+16);

  const captionText=stage==='plot'?(locked?'BURN PLOTTED · IGNITE WHEN READY':drag?(evalNow.valid?'HOLD STEADY · RELEASE TO LOCK':'OUT OF TOLERANCE'):'HOLD THE SATELLITE · DRAG TO PLOT BURN'):stage==='approach'?'TRANSFER BURN UNDERWAY':stage==='coast'?(inWindow?'INSERTION WINDOW OPEN · FIRE NOW':nearWindow?'WINDOW APPROACHING · STAND BY':'COASTING · AWAIT INSERTION WINDOW'):'CIRCULARIZATION COMPLETE';
  const captionColor=stage==='coast'?(inWindow?'#c9ff4d':nearWindow?'#ffd166':'#89948d'):stage==='plot'&&drag&&!evalNow.valid?'#ff5964':(locked||stage!=='plot')?'#c9ff4d':'#89948d';
  const readoutText=stage==='plot'?(locked?'BURN PLOTTED · READY TO IGNITE':drag?`BURN RADIUS ${Math.round(drag.dist)} · TARGET ${Math.round(cfg.r2)}±${cfg.radiusTol}`:'AWAITING BURN PLOT'):stage==='approach'?'IGNITING TRANSFER BURN':stage==='coast'?(inWindow?'FIRE CIRCULARIZATION NOW':nearWindow?'STAND BY · WINDOW APPROACHING':'COASTING TO INSERTION WINDOW'):'ORBIT STABLE';
  const readoutColor=stage==='coast'?(inWindow?'var(--green)':nearWindow?'var(--yellow)':'#89948d'):stage==='plot'?(locked?'var(--green)':drag?(evalNow.valid?'var(--green)':'var(--red)'):'var(--yellow)'):'var(--yellow)';

  return <>
    <Header title="ORBITAL BURN" sub={`ORBIT ${cfg.raiseMode?'DECAYING':'OVER-BOOSTED'} · TWO-BURN TRANSFER REQUIRED`}/>
    <p className="instructions">Drag from the satellite to plot a transfer burn onto the home orbital plane — not too hot, not too weak. Ignite the burn, then watch the coast: fire the circularization burn only while the satellite is inside the insertion window, or the orbit stays unstable and you'll have to replot.</p>
    <div style={{display:'grid',placeItems:'center',margin:'24px 0'}}>
      <svg viewBox="0 0 300 300" width="320" height="320" style={{background:'#0c1210',border:'1px solid #34403a',cursor:stage==='plot'&&!locked?'crosshair':'default',touchAction:'none'}} onPointerDown={start} onPointerMove={move} onPointerUp={release} onPointerCancel={release}>
        <circle cx={cx} cy={cy} r={cfg.minSafeR} fill="rgba(255,89,100,.12)" stroke="#ff5964" strokeWidth="1" strokeDasharray="2 4"/>
        <circle cx={cx} cy={cy} r={cfg.r1} fill="none" stroke="#ff5964" strokeWidth="1.5" strokeDasharray="3 5" opacity=".75"/>
        <circle cx={cx} cy={cy} r={cfg.r2} fill="none" stroke="#3b4540" strokeWidth="2"/>
        <path d={sectorPath} fill={inWindow?'rgba(201,255,77,.38)':'rgba(201,255,77,.14)'} stroke={inWindow?'#c9ff4d':'#5c6b60'} strokeWidth={inWindow?2.5:1.5}/>
        <circle cx={cx} cy={cy} r="13" fill="#eef4eb"/>
        {pts&&<path d={pathD(pts)} fill="none" stroke={locked?'#c9ff4d':evalNow.valid?'#c9ff4d':'#ff5964'} strokeWidth={locked?3:2} strokeDasharray={locked?undefined:'5 4'} style={locked?{filter:'drop-shadow(0 0 6px #c9ff4d)'}:{}}/>}
        {stage==='approach'&&approachPts&&<path d={pathD(approachPts)} fill="none" stroke="#c9ff4d" strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={1-t} style={{filter:'drop-shadow(0 0 8px #c9ff4d)'}}/>}
        {stage==='coast'&&<polyline points={trail.map(p=>p.join(',')).join(' ')} fill="none" stroke="#c9ff4d" strokeWidth="3" style={{filter:'drop-shadow(0 0 8px #c9ff4d)'}}/>}
        <circle cx={satNow[0]} cy={satNow[1]} r={stage==='plot'?7:5} fill={locked||stage!=='plot'?'#c9ff4d':'#eef4eb'} style={locked||stage!=='plot'?{filter:'drop-shadow(0 0 8px #c9ff4d)'}:{}}/>
        <text x={wlx} y={wly} textAnchor="middle" fill={inWindow?'#c9ff4d':'#7f8c84'} fontSize="8">INSERTION WINDOW</text>
        <text x="150" y="292" textAnchor="middle" fontSize="9" fill={captionColor}>{captionText}</text>
      </svg>
    </div>
    <div className="readout" style={{color:readoutColor}}>{readoutText}</div>
    <div className="legend"><span><i className="dot green"/>INSERTION WINDOW</span><span><i className="dot redbg"/>MIN SAFE ALTITUDE</span></div>
    {stage==='plot'&&locked&&<div className="actions"><button className="action" onClick={()=>setStage('approach')}>IGNITE TRANSFER BURN</button><button className="action" onClick={()=>{setLocked(null);setError('')}}>REPLOT</button></div>}
    {stage==='coast'&&<div className="actions"><button className="action" style={{borderColor:inWindow?'var(--green)':nearWindow?'var(--yellow)':'#39453f',color:inWindow?'var(--green)':nearWindow?'var(--yellow)':'#85908a'}} onClick={fireCircularization}>FIRE CIRCULARIZATION BURN</button></div>}
    {stage==='success'?<div className="success">CIRCULARIZATION ACCURATE · ORBIT {cfg.raiseMode?'RAISED':'LOWERED'} INTO HOME PLANE</div>:(error&&stage==='plot')?<div className="failure">{error}</div>:null}
  </>;
}
function Sensor(){const [pick,setPick]=useState(null),[fault]=useState(()=>shuffle(['A','B','C'])[0]),[vals]=useState(()=>{const out={A:71,B:71,C:71};out[fault]=88+Math.floor(Math.random()*9);return out});return <><Header title="SENSOR FAULT" sub="TEMPERATURE STREAMS DISAGREE"/><p className="instructions">Compare the redundant sensors. Select the outlier and switch it offline.</p><div className="pixel-grid">{['A','B','C'].map(x=><button className={'node '+(pick===x?(x===fault?'done':'fail'):'')} onClick={()=>setPick(x)} key={x}>SENSOR {x}<br/><small>{vals[x]}°C</small></button>)}</div><Result ok={pick===fault}>{pick===fault?`SENSOR ${fault} ISOLATED · CONSENSUS RESTORED`:'One stream is statistically abnormal.'}</Result></>}
function Attitude(){const [a,setA]=useState(-28);const ok=Math.abs(a)<=3;return <><Header title="ATTITUDE DRIFT" sub="POINTING ERROR 28° · ANTENNA MISALIGNED"/><p className="instructions">Use the reaction wheels to bring the antenna back to Earth-pointing. Stop inside the narrow lock window.</p><div className="readout">{a}°</div><input className="range" type="range" min="-90" max="90" value={a} onChange={e=>setA(+e.target.value)}/><Result ok={ok}>{ok?'ATTITUDE LOCKED · DOWNLINK READY':'Fine-tune the pointing error to ±3°.'}</Result></>}
function Battery(){const [cells,setCells]=useState([92,48,76]);const ok=Math.max(...cells)-Math.min(...cells)<10;return <><Header title="BATTERY CELLS" sub="CELL IMBALANCE · BUS PROTECTION ACTIVE"/><p className="instructions">Click the highest cell to bleed charge into the lowest cell. Balance all three without dropping below 40%.</p><div className="pixel-grid">{cells.map((n,i)=><button className={'cell '+(ok?'done':'')} onClick={()=>{const hi=cells.indexOf(Math.max(...cells)),lo=cells.indexOf(Math.min(...cells));if(n===cells[hi]&&n-cells[lo]>2){let c=[...cells];c[hi]-=4;c[lo]+=4;setCells(c)}}} key={i}>CELL {i+1}<br/><b>{n}%</b></button>)}</div><Result ok={ok}>{ok?'CELL BALANCE RESTORED · BATTERY ONLINE':'Select the highest cell repeatedly to balance the pack.'}</Result></>}
function Impact(){const [pick,setPick]=useState(null),[fault]=useState(()=>shuffle(['COMMS','POWER','THERMAL','PAYLOAD','GUIDANCE','BATTERY'])[0]);return <><Header title="MODULE IMPACT" sub="PRESSURE LOSS · STRUCTURAL BREACH DETECTED"/><p className="instructions">Isolate the damaged module before the pressure loss spreads. The breach location varies by incident.</p><div className="pixel-grid">{['COMMS','POWER','THERMAL','PAYLOAD','GUIDANCE','BATTERY'].map(x=><button className={'module '+(pick===x?(x===fault?'done':'fail'):'')} onClick={()=>setPick(x)} key={x}>{x}</button>)}</div><Result ok={pick===fault}>{pick===fault?'MODULE ISOLATED · PRESSURE STABLE':'Trace the pressure-loss indicator to the damaged module.'}</Result></>}
function Radiation(){const [t,setT]=useState(0);useEffect(()=>{if(t>0){const id=setTimeout(()=>setT(t-1),1000);return()=>clearTimeout(id)}},[t]);return <><Header title="RADIATION EVENT" sub="SOLAR PARTICLE FLUX ELEVATED"/><p className="instructions">This is a transient event. Enter shielding protocol, then wait. Intervening too early risks unnecessary degradation.</p><div className="readout">{t?`FLUX FALLING · ${t}s`:'FLUX NOMINAL'}</div><button className="action" onClick={()=>setT(8)} disabled={t>0}>{t?'WAITING FOR CLEAR':'ENTER SHIELDING PROTOCOL'}</button><Result ok={t===0&&false}>{t===0?'Wait for the event to pass without cycling power.':''}</Result></>}
function App(){const requested=new URLSearchParams(location.search).get('type');const [type,setType]=useState(games.some(g=>g[0]===requested)?requested:'thermal');const C={thermal:Thermal,power:Power,solar:Solar,contact:Contact,comms:Comms,process:Process,orbit:Orbit,sensor:Sensor,attitude:Attitude,battery:Battery,impact:Impact,radiation:Radiation}[type];return <Frame type={type} setType={setType}><C/></Frame>};ReactDOM.createRoot(document.getElementById('root')).render(<App/>);



// const {useState,useEffect,useMemo}=React;

// const shuffle=a=>{
//   const x=[...a];
//   for(let i=x.length-1;i>0;i--){
//     const j=Math.floor(Math.random()*(i+1));
//     [x[i],x[j]]=[x[j],x[i]];
//   }
//   return x;
// };

// const games=[
//   ['thermal','THERMAL ROUTING','Valve sequencing'],
//   ['power','POWER BUS','Wire matching'],
//   ['solar','SOLAR ALIGNMENT','Point at the sun'],
//   ['contact','MISSED CONTACT','Acquire downlink'],
//   ['comms','COMMS ALIGNMENT','Tune the carrier'],
//   ['process','PROCESS FAULT','Restart sequence'],
//   ['thruster','THRUSTER ARRAY','Balance net force'],
//   ['sensor','SENSOR FAULT','Find the outlier'],
//   ['attitude','ATTITUDE DRIFT','Stabilize pointing'],
//   ['battery','BATTERY CELLS','Balance the pack'],
//   ['impact','MODULE IMPACT','Isolate the breach'],
//   ['radiation','RADIATION EVENT','Wait it out']
// ];

// function Frame({type,setType,children}){
//   const embedded=Boolean(new URLSearchParams(location.search).get('type'));

//   return (
//     <div className="app">
//       <header className="top">
//         <span className="brand">SIX HUNDRED / REPAIR LAB</span>
//         <span className="eyebrow">SAT 421 · MANUAL OVERRIDE</span>
//       </header>

//       <div
//         className={'layout '+(embedded?'embedded':'')}
//         style={embedded?{display:'block',marginTop:0}:{}}
//       >
//         {!embedded&&
//           <nav className="menu">
//             {games.map(([id,name])=>(
//               <button
//                 key={id}
//                 className={type===id?'active':''}
//                 onClick={()=>setType(id)}
//               >
//                 {name}
//               </button>
//             ))}
//           </nav>
//         }

//         <main
//           className="board"
//           style={embedded?{minHeight:'100%',border:0}:{}}
//         >
//           {children}
//         </main>
//       </div>
//     </div>
//   );
// }

// function Header({title,sub}){
//   return (
//     <>
//       <div className="eyebrow">Critical subsystem interaction</div>
//       <h1>{title}</h1>
//       <div className="signal">{sub}</div>
//     </>
//   );
// }

// function Result({ok,children}){
//   const [sent,setSent]=useState(false);

//   const finish=()=>{
//     if(!sent&&window.parent!==window){
//       setSent(true);
//       setTimeout(()=>{
//         window.parent.postMessage({type:'repair-complete'},'*');
//       },1200);
//     }
//   };

//   if(!children)return null;

//   return (
//     <div className={ok?'success':'failure'}>
//       {sent?'SUCCESSFUL EXECUTION':children}

//       {ok&&(
//         <div className="actions">
//           <button
//             className="action"
//             onClick={finish}
//             disabled={sent}
//           >
//             {sent?'SUCCESSFUL EXECUTION':'EXECUTE'}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// function Thermal(){
//   const [routeValve]=useState(()=>Math.random()<.5?'VALVE A':'VALVE B');
//   const [path,setPath]=useState([]);
//   const [dragging,setDragging]=useState(false);
//   const [error,setError]=useState('');

//   const nodes={
//     CORE:[40,110],
//     PUMP:[105,110],
//     'VALVE A':[170,52],
//     'VALVE B':[170,168],
//     RADIATOR:[258,110]
//   };

//   const target=['CORE','PUMP',routeValve,'RADIATOR'];
//   const temp=78-path.length*8;
//   const pressure=42+path.length*16;
//   const ok=path.length===4;

//   const follow=e=>{
//     if(!dragging||ok)return;

//     const box=e.currentTarget.getBoundingClientRect();
//     const x=(e.clientX-box.left)/box.width*300;
//     const y=(e.clientY-box.top)/box.height*220;

//     const node=Object.keys(nodes).find(
//       n=>Math.hypot(nodes[n][0]-x,nodes[n][1]-y)<23
//     );

//     if(!node||path.includes(node))return;

//     if(node===target[path.length]){
//       setPath(p=>[...p,node]);
//       setError('');
//     }else{
//       setPath([]);
//       setDragging(false);
//       setError('FLOW LOST · COOLANT ENTERED HOT BYPASS');
//     }
//   };

//   const start=e=>{
//     setPath([]);
//     setError('');
//     setDragging(true);

//     e.currentTarget.setPointerCapture?.(e.pointerId);

//     const box=e.currentTarget.getBoundingClientRect();
//     const x=(e.clientX-box.left)/box.width*300;
//     const y=(e.clientY-box.top)/box.height*220;

//     if(Math.hypot(40-x,110-y)<28){
//       setPath(['CORE']);
//     }else{
//       setDragging(false);
//       setError('START AT THE HOT CORE');
//     }
//   };

//   const line=(a,b,on)=>{
//     const [x1,y1]=nodes[a];
//     const [x2,y2]=nodes[b];

//     return (
//       <line
//         key={a+b}
//         x1={x1}
//         y1={y1}
//         x2={x2}
//         y2={y2}
//         stroke={on?'#c9ff4d':'#34403a'}
//         strokeWidth={on?7:4}
//         strokeLinecap="round"
//       />
//     );
//   };

//   return (
//     <>
//       <Header
//         title="THERMAL ROUTING"
//         sub={`CORE ${temp}°C · COOLANT ${pressure} kPa`}
//       />

//       <p className="instructions">
//         Hold and drag from the hot core through the pump,
//         the safe valve, and into the radiator. The red route is a hot bypass.
//       </p>

//       <svg
//         viewBox="0 0 300 220"
//         width="100%"
//         style={{
//           maxWidth:650,
//           display:'block',
//           margin:'28px 0',
//           background:'#0c1210',
//           border:'1px solid #34403a',
//           cursor:dragging?'grabbing':'crosshair',
//           touchAction:'none'
//         }}
//         onPointerDown={start}
//         onPointerMove={follow}
//         onPointerUp={()=>setDragging(false)}
//         onPointerCancel={()=>setDragging(false)}
//       >
//         {line('CORE','PUMP',path.includes('PUMP'))}
//         {line('PUMP','VALVE A',path.includes('VALVE A'))}
//         {line('PUMP','VALVE B',path.includes('VALVE B'))}
//         {line(
//           'VALVE A',
//           'RADIATOR',
//           path.includes('VALVE A')&&path.includes('RADIATOR')
//         )}
//         {line(
//           'VALVE B',
//           'RADIATOR',
//           path.includes('VALVE B')&&path.includes('RADIATOR')
//         )}

//         {Object.entries(nodes).map(([n,[x,y]])=>(
//           <g key={n}>
//             <circle
//               cx={x}
//               cy={y}
//               r="20"
//               fill={
//                 n===routeValve
//                   ?'#172714'
//                   :n.startsWith('VALVE')
//                     ?'#351518'
//                     :'#13201b'
//               }
//               stroke={
//                 path.includes(n)
//                   ?'#c9ff4d'
//                   :n===routeValve
//                     ?'#c9ff4d'
//                     :n.startsWith('VALVE')
//                       ?'#ff5964'
//                       :'#738079'
//               }
//               strokeWidth="3"
//             />
//             <text
//               x={x}
//               y={y+4}
//               textAnchor="middle"
//               fill="#eef4eb"
//               fontSize="8"
//             >
//               {n}
//             </text>
//           </g>
//         ))}

//         <text
//           x="150"
//           y="205"
//           textAnchor="middle"
//           fill={dragging?'#c9ff4d':'#89948d'}
//           fontSize="10"
//         >
//           {dragging?'DRAGGING COOLANT FLOW':'HOLD ON CORE · TRACE THE SAFE ROUTE'}
//         </text>
//       </svg>

//       <div
//         className="readout"
//         style={{
//           color:
//             temp>70
//               ?'var(--red)'
//               :temp>55
//                 ?'var(--yellow)'
//                 :'var(--green)'
//         }}
//       >
//         CORE {temp}°C · PRESSURE {pressure} kPa
//       </div>

//       <button
//         className="action"
//         onClick={()=>{
//           setPath([]);
//           setError('');
//         }}
//       >
//         RESET ROUTE
//       </button>

//       <Result ok={ok}>
//         {ok
//           ?'THERMAL LOOP STABLE · COOLANT FLOW CONFIRMED'
//           :error||'Drag a continuous coolant path through the system.'
//         }
//       </Result>
//     </>
//   );
// }

// function Power(){
//   const [left,setLeft]=useState(null);
//   const [pairs,setPairs]=useState([]);
//   const [leftColors]=useState(()=>shuffle(['red','blue','green']));
//   const [rightColors]=useState(()=>shuffle(['red','blue','green']));

//   const colors={
//     red:'#ff5964',
//     blue:'#55b6ff',
//     green:'#c9ff4d'
//   };

//   const ys=[60,150,240];

//   const connect=(side,c)=>{
//     if(pairs.includes(c))return;

//     if(!left){
//       setLeft({side,c});
//     }else if(left.side!==side&&left.c===c){
//       setPairs(p=>[...p,c]);
//       setLeft(null);
//     }else{
//       setLeft({side,c});
//     }
//   };

//   const socket=(side,c,i)=>{
//     const x=side==='bus'?24:476;
//     const y=ys[i];
//     const chosen=left?.side===side&&left.c===c;
//     const done=pairs.includes(c);

//     return (
//       <g
//         key={side+c}
//         onClick={()=>connect(side,c)}
//         style={{cursor:'pointer'}}
//       >
//         <rect
//           x={x}
//           y={y}
//           width="100"
//           height="48"
//           rx="4"
//           fill={chosen?'#f4f7ef':'#101614'}
//           stroke={chosen?'#f4f7ef':colors[c]}
//           strokeWidth="3"
//         />

//         <circle
//           cx={side==='bus'?112:488}
//           cy={y+24}
//           r="6"
//           fill={colors[c]}
//         />

//         <text
//           x={x+50}
//           y={y+20}
//           textAnchor="middle"
//           fill={chosen?'#070809':colors[c]}
//           fontSize="12"
//         >
//           {side.toUpperCase()}
//         </text>

//         <text
//           x={x+50}
//           y={y+35}
//           textAnchor="middle"
//           fill={chosen?'#070809':colors[c]}
//           fontSize="11"
//         >
//           {c.toUpperCase()}{done?' ✓':''}
//         </text>
//       </g>
//     );
//   };

//   return (
//     <>
//       <Header
//         title="POWER BUS"
//         sub="VOLTAGE OSCILLATION · BACKUP BUS AVAILABLE"
//       />

//       <p className="instructions">
//         Patch each colored power bus to its matching load.
//         Cable routing is independent of terminal position.
//       </p>

//       <svg
//         viewBox="0 0 600 310"
//         width="100%"
//         style={{
//           maxWidth:720,
//           display:'block',
//           margin:'26px 0',
//           background:'#0c1210',
//           border:'1px solid #34403a'
//         }}
//       >
//         {pairs.map(c=>{
//           const from=leftColors.indexOf(c);
//           const to=rightColors.indexOf(c);
//           const y1=ys[from]+24;
//           const y2=ys[to]+24;

//           return (
//             <path
//               key={c}
//               d={`M 124 ${y1} C 240 ${y1}, 360 ${y2}, 476 ${y2}`}
//               fill="none"
//               stroke={colors[c]}
//               strokeWidth="7"
//               strokeLinecap="round"
//               style={{
//                 filter:`drop-shadow(0 0 6px ${colors[c]})`
//               }}
//             />
//           );
//         })}

//         {leftColors.map((c,i)=>socket('bus',c,i))}
//         {rightColors.map((c,i)=>socket('load',c,i))}

//         <text
//           x="300"
//           y="295"
//           textAnchor="middle"
//           fill="#849089"
//           fontSize="11"
//         >
//           SELECT BUS SOCKET → MATCHING LOAD SOCKET
//         </text>
//       </svg>

//       <Result ok={pairs.length===3}>
//         {pairs.length===3
//           ?'POWER BUS BALANCED · 68% OUTPUT'
//           :'Select a colored bus socket, then its matching load socket.'
//         }
//       </Result>
//     </>
//   );
// }

// function Solar(){
//   const [angle,setAngle]=useState(28);
//   const [sun,setSun]=useState(()=>80+Math.floor(Math.random()*180));

//   useEffect(()=>{
//     const id=setInterval(()=>{
//       setSun(s=>(s+((Math.random()>.5?1:-1)*2)+360)%360);
//     },3200);

//     return()=>clearInterval(id);
//   },[]);

//   const delta=Math.abs(((angle-sun+180)%360)-180);
//   const width=10;
//   const ok=delta<width/2;

//   const polar=(deg,r)=>{
//     const a=deg*Math.PI/180;
//     return [
//       130+Math.cos(a)*r,
//       130-Math.sin(a)*r
//     ];
//   };

//   const [x1,y1]=polar(angle-width,112);
//   const [x2,y2]=polar(angle+width,112);

//   const sector=
//     `M 130 130 L ${x1} ${y1} A 112 112 0 0 1 ${x2} ${y2} Z`;

//   const [sx,sy]=polar(sun,105);

//   return (
//     <>
//       <Header
//         title="SOLAR ALIGNMENT"
//         sub="ARRAY MISALIGNED · POWER GENERATION 31%"
//       />

//       <p className="instructions">
//         Rotate the array’s field of view until the moving sun enters
//         the narrow green sector. The target drifts while you align.
//       </p>

//       <div style={{display:'grid',placeItems:'center',margin:'28px 0'}}>
//         <svg
//           viewBox="0 0 260 260"
//           width="280"
//           height="280"
//           style={{
//             background:'radial-gradient(circle,#101b16,#080b0a 65%)',
//             border:'2px solid #3b4540',
//             borderRadius:'50%'
//           }}
//         >
//           <circle
//             cx="130"
//             cy="130"
//             r="112"
//             fill="none"
//             stroke="#3b4540"
//             strokeWidth="2"
//           />

//           <path
//             d={sector}
//             fill={ok?'rgba(201,255,77,.32)':'rgba(255,209,102,.18)'}
//             stroke={ok?'#c9ff4d':'#ffd166'}
//             strokeWidth="2"
//           />

//           <circle
//             cx="130"
//             cy="130"
//             r="11"
//             fill={ok?'#c9ff4d':'#777'}
//           />

//           <circle
//             cx={sx}
//             cy={sy}
//             r="8"
//             fill="#ffd166"
//           />

//           <circle
//             cx="130"
//             cy="130"
//             r="5"
//             fill="#fff"
//           />
//         </svg>
//       </div>

//       <div className="readout">
//         ARRAY ANGLE {angle}° · SUN {sun}° · INPUT {ok?'86':'31'}%
//       </div>

//       <input
//         className="range"
//         type="range"
//         min="0"
//         max="359"
//         value={angle}
//         onChange={e=>setAngle(+e.target.value)}
//       />

//       <div className="legend">
//         <span>
//           <i className="dot green"/>
//           LOCK WINDOW ±5°
//         </span>

//         <span>
//           <i className="dot yellowbg"/>
//           SUN TARGET DRIFTING
//         </span>
//       </div>

//       <Result ok={ok}>
//         {ok
//           ?'SUN LOCK ACQUIRED · BATTERY CHARGING'
//           :'Rotate the sector until it captures the sun.'
//         }
//       </Result>
//     </>
//   );
// }

// function Contact(){
//   const [orbit,setOrbit]=useState(212);
//   const [sweep,setSweep]=useState(30);
//   const [linked,setLinked]=useState(false);
//   const [message,setMessage]=useState('WAIT FOR CONTACT WINDOW');

//   useEffect(()=>{
//     const id=setInterval(()=>{
//       setOrbit(a=>(a+1.15)%360);
//       setSweep(a=>(a+2.05)%360);
//     },60);

//     return()=>clearInterval(id);
//   },[]);

//   const polar=(cx,cy,deg,r)=>{
//     const a=deg*Math.PI/180;
//     return [
//       cx+Math.cos(a)*r,
//       cy-Math.sin(a)*r
//     ];
//   };

//   const [sx,sy]=polar(150,145,orbit,112);
//   const delta=Math.abs(((sweep-orbit+180)%360)-180);
//   const width=34;
//   const inView=delta<width/2;

//   const [a1x,a1y]=polar(150,145,sweep-width/2,118);
//   const [a2x,a2y]=polar(150,145,sweep+width/2,118);

//   const sector=
//     `M 150 145 L ${a1x} ${a1y} A 118 118 0 0 1 ${a2x} ${a2y} Z`;

//   const downlink=()=>{
//     if(inView){
//       setLinked(true);
//       setMessage('GROUND LINK ESTABLISHED');
//     }else{
//       setMessage('NO CONTACT WINDOW · HOLD');
//     }
//   };

//   return (
//     <>
//       <Header
//         title="MISSED CONTACT"
//         sub="DOWNLINK WINDOW APPROACHING · GROUND STATION 07"
//       />

//       <p className="instructions">
//         The ground station dish is sweeping its coverage sector.
//         Press downlink only when the moving satellite is inside the green sector.
//       </p>

//       <div style={{display:'grid',placeItems:'center',margin:'24px 0'}}>
//         <svg
//           viewBox="0 0 300 290"
//           width="340"
//           height="310"
//           style={{
//             background:'#0c1210',
//             border:'1px solid #34403a'
//           }}
//         >
//           <circle
//             cx="150"
//             cy="145"
//             r="118"
//             fill="none"
//             stroke="#34403a"
//             strokeWidth="2"
//           />

//           <path
//             d={sector}
//             fill={inView?'rgba(201,255,77,.32)':'rgba(255,209,102,.12)'}
//             stroke={inView?'#c9ff4d':'#ffd166'}
//             strokeWidth="2"
//           />

//           <circle
//             cx={sx}
//             cy={sy}
//             r="4"
//             fill="#ffd166"
//           />

//           <text
//             x={sx}
//             y={sy-16}
//             textAnchor="middle"
//             fill="#f4f7ef"
//             fontSize="9"
//           >
//             SAT 421
//           </text>

//           <text
//             x="150"
//             y="268"
//             textAnchor="middle"
//             fill={inView?'#c9ff4d':'#89948d'}
//             fontSize="11"
//           >
//             {inView
//               ?'CONTACT WINDOW OPEN · DOWNLINK NOW'
//               :'DISH SWEEPING · ACQUIRE SATELLITE'
//             }
//           </text>
//         </svg>
//       </div>

//       <div className="actions">
//         <button
//           className="action"
//           onClick={downlink}
//           style={{
//             borderColor:inView?'var(--green)':'var(--yellow)',
//             color:inView?'var(--green)':'var(--yellow)'
//           }}
//         >
//           DOWNLINK
//         </button>
//       </div>

//       <Result ok={linked}>
//         {linked
//           ?'DOWNLINK COMPLETE · TELEMETRY RECEIVED'
//           :message
//         }
//       </Result>
//     </>
//   );
// }

// function Comms(){
//   const [target]=useState(()=>55+Math.floor(Math.random()*35));
//   const [f,setF]=useState(()=>target-18);
//   const ok=Math.abs(f-target)<=3;

//   return (
//     <>
//       <Header
//         title="COMMS ALIGNMENT"
//         sub="RSSI -96 dBm · CARRIER LOCK LOST"
//       />

//       <p className="instructions">
//         Tune the carrier into the ground-station window.
//         The target frequency is somewhere in the highlighted band.
//       </p>

//       <div className="readout">
//         {f}.0 MHz · TARGET {target}±3
//       </div>

//       <input
//         className="range"
//         type="range"
//         min="0"
//         max="100"
//         value={f}
//         onChange={e=>setF(+e.target.value)}
//       />

//       <div className="bar">
//         <i
//           style={{
//             width:`${f}%`,
//             background:ok?'var(--green)':'var(--blue)'
//           }}
//         />
//       </div>

//       <Result ok={ok}>
//         {ok
//           ?'CARRIER LOCKED · CONTACT RESTORED'
//           :'Sweep the band until the carrier locks.'
//         }
//       </Result>
//     </>
//   );
// }

// function Process(){
//   const [processes]=useState(()=>shuffle([
//     'PACKET RETRY',
//     'TELEMETRY CACHE',
//     'IMAGE PIPELINE',
//     'LOG AGGREGATOR',
//     'PAYLOAD INDEXER',
//     'MEMORY SCRUBBER'
//   ]));

//   const [leaks]=useState(
//     ()=>new Set(
//       shuffle([
//         'PACKET RETRY',
//         'TELEMETRY CACHE',
//         'IMAGE PIPELINE',
//         'LOG AGGREGATOR',
//         'PAYLOAD INDEXER',
//         'MEMORY SCRUBBER'
//       ]).slice(0,3)
//     )
//   );

//   const [warnings]=useState(
//     ()=>new Set([
//       ...leaks,
//       processes.find(p=>!leaks.has(p))
//     ])
//   );

//   const [stopped,setStopped]=useState([]);

//   const correct=stopped.filter(p=>leaks.has(p)).length;
//   const wrong=stopped.length-correct;
//   const cpu=98-correct*12+wrong*6;
//   const rssi=82-wrong*12;
//   const ok=correct===3&&wrong===0&&cpu<70;

//   const toggle=p=>{
//     setStopped(s=>
//       s.includes(p)
//         ?s.filter(x=>x!==p)
//         :[...s,p]
//     );
//   };

//   return (
//     <>
//       <Header
//         title="MEMORY LEAK"
//         sub={`CPU ${cpu}% · RSSI ${rssi} dBm · ${correct}/3 LEAKS ISOLATED`}
//       />

//       <p className="instructions">
//         Three subprocesses are leaking memory.
//         Isolate the right combination until CPU falls below 70%.
//         One warning is a decoy.
//       </p>

//       <div className="pixel-grid">
//         {processes.map(p=>{
//           const off=stopped.includes(p);
//           const actual=leaks.has(p);
//           const suspect=warnings.has(p);

//           return (
//             <button
//               className={
//                 'node '+(
//                   off
//                     ?(actual?'done':'fail')
//                     :''
//                 )
//               }
//               onClick={()=>toggle(p)}
//               key={p}
//             >
//               {p}
//               <br/>
//               <small>
//                 {off
//                   ?(actual?'ISOLATED':'HEALTHY SERVICE OFFLINE')
//                   :(suspect?'ALLOC WARN · HIGH':'NOMINAL LOAD')
//                 }
//               </small>
//             </button>
//           );
//         })}
//       </div>

//       <div className="bar">
//         <i
//           style={{
//             width:`${cpu}%`,
//             background:cpu<70?'var(--green)':'var(--red)'
//           }}
//         />
//       </div>

//       <div
//         className="readout"
//         style={{
//           color:cpu<70?'var(--green)':'var(--red)'
//         }}
//       >
//         CPU {cpu}% · RSSI {rssi} dBm
//       </div>

//       <Result ok={ok}>
//         {ok
//           ?'LEAKS CONTAINED · CPU BELOW SAFE THRESHOLD'
//           :'Isolate three leaking services, and restore every healthy service.'
//         }
//       </Result>
//     </>
//   );
// }


// /* ---------------- thruster array ---------------- */

// function ThrusterArray(){
//   const pods=[
//     {
//       id:'T1',
//       angle:-90,
//       force:{x:0,y:1},
//       torque:-1
//     },
//     {
//       id:'T2',
//       angle:-30,
//       force:{x:-0.866,y:0.5},
//       torque:-0.5
//     },
//     {
//       id:'T3',
//       angle:30,
//       force:{x:-0.866,y:-0.5},
//       torque:0.5
//     },
//     {
//       id:'T4',
//       angle:90,
//       force:{x:0,y:-1},
//       torque:1
//     },
//     {
//       id:'T5',
//       angle:150,
//       force:{x:0.866,y:-0.5},
//       torque:0.5
//     },
//     {
//       id:'T6',
//       angle:210,
//       force:{x:0.866,y:0.5},
//       torque:-0.5
//     }
//   ];

//   const [degraded]=useState(
//     ()=>shuffle(['T1','T2','T3','T4','T5','T6']).slice(
//       0,
//       Math.random()<0.45?1:2
//     )
//   );

//   const [selected,setSelected]=useState([]);

//   const [target]=useState(()=>{
//     const directions=[
//       {x:0.866,y:-0.5,label:'↗'},
//       {x:0.866,y:0.5,label:'↘'},
//       {x:-0.866,y:-0.5,label:'↖'},
//       {x:-0.866,y:0.5,label:'↙'},
//       {x:0,y:-1,label:'↑'},
//       {x:0,y:1,label:'↓'}
//     ];

//     return directions[Math.floor(Math.random()*directions.length)];
//   });

//   const [targetThrust]=useState(
//     ()=>62+Math.floor(Math.random()*21)
//   );

//   const [maxTorque]=useState(
//     ()=>6+Math.floor(Math.random()*5)
//   );

//   const [executed,setExecuted]=useState(false);

//   const output=pod=>{
//     if(degraded.includes(pod.id)){
//       return 0.25+Math.random()*0.1;
//     }

//     return 1;
//   };

//   const values=useMemo(()=>{
//     let x=0;
//     let y=0;
//     let torque=0;
//     let thrustSum=0;

//     selected.forEach(id=>{
//       const pod=pods.find(p=>p.id===id);
//       if(!pod)return;

//       const power=degraded.includes(id)
//         ?0.25
//         :1;

//       x+=pod.force.x*power;
//       y+=pod.force.y*power;

//       torque+=pod.torque*power;

//       thrustSum+=power;
//     });

//     const magnitude=Math.hypot(x,y);

//     const nx=magnitude?x/magnitude:0;
//     const ny=magnitude?y/magnitude:0;

//     const dot=nx*target.x+ny*target.y;
//     const clamped=Math.max(-1,Math.min(1,dot));
//     const angleError=Math.acos(clamped)*180/Math.PI;

//     const percent=Math.min(
//       100,
//       thrustSum*42
//     );

//     return {
//       x,
//       y,
//       magnitude,
//       torque,
//       thrustPercent:percent,
//       angleError
//     };
//   },[selected,degraded,target]);

//   const thrustOk=
//     values.thrustPercent>=targetThrust-8 &&
//     values.thrustPercent<=targetThrust+12;

//   const directionOk=values.angleError<=12;

//   const torqueOk=
//     Math.abs(values.torque)*10<=maxTorque;

//   const safe=
//     selected.length>0 &&
//     thrustOk &&
//     directionOk &&
//     torqueOk;

//   const toggle=id=>{
//     if(executed)return;

//     setSelected(s=>{
//       if(s.includes(id)){
//         return s.filter(x=>x!==id);
//       }

//       return [...s,id];
//     });
//   };

//   const reset=()=>{
//     setSelected([]);
//     setExecuted(false);
//   };

//   const execute=()=>{
//     if(safe){
//       setExecuted(true);
//     }
//   };

//   const forceArrowLength=
//     Math.min(105,30+values.magnitude*35);

//   const forceAngle=
//     Math.atan2(values.y,values.x)*180/Math.PI;

//   const status=
//     executed
//       ?'BURN COMPLETE'
//       :safe
//         ?'SAFE FIRING PATTERN'
//         :'SELECT A SAFE FIRING PATTERN';

//   return (
//     <>
//       <Header
//         title="THRUSTER ARRAY"
//         sub={`CORRECTIVE BURN REQUIRED · TARGET VECTOR ${target.label}`}
//       />

//       <p className="instructions">
//         One or more ion thrusters are degraded.
//         Select a firing pattern that produces the required net force
//         without introducing excessive rotational torque.
//       </p>

//       <div
//         style={{
//           display:'grid',
//           gridTemplateColumns:'minmax(300px,1fr) 260px',
//           gap:24,
//           margin:'28px 0'
//         }}
//       >
//         <div
//           style={{
//             border:'1px solid #34403a',
//             background:'#0c1210',
//             padding:18
//           }}
//         >
//           <svg
//             viewBox="0 0 520 420"
//             width="100%"
//             style={{
//               display:'block',
//               maxWidth:620,
//               margin:'auto'
//             }}
//           >
//             <defs>
//               <filter id="thrusterGlow">
//                 <feGaussianBlur stdDeviation="4"/>
//               </filter>
//             </defs>

//             {/* target vector */}
//             <line
//               x1="260"
//               y1="210"
//               x2={260+target.x*115}
//               y2={210+target.y*115}
//               stroke="#ffd166"
//               strokeWidth="3"
//               strokeDasharray="8 7"
//             />

//             <polygon
//               points={`
//                 ${260+target.x*115},
//                 ${210+target.y*115}
//                 ${260+target.x*100-target.y*10},
//                 ${210+target.y*100+target.x*10}
//                 ${260+target.x*100+target.y*10},
//                 ${210+target.y*100-target.x*10}
//               `}
//               fill="#ffd166"
//             />

//             {/* net force */}
//             {values.magnitude>0&&(
//               <>
//                 <line
//                   x1="260"
//                   y1="210"
//                   x2={
//                     260+
//                     Math.cos(forceAngle*Math.PI/180)*
//                     forceArrowLength
//                   }
//                   y2={
//                     210+
//                     Math.sin(forceAngle*Math.PI/180)*
//                     forceArrowLength
//                   }
//                   stroke={directionOk?'#c9ff4d':'#ff5964'}
//                   strokeWidth="4"
//                 />

//                 <circle
//                   cx={
//                     260+
//                     Math.cos(forceAngle*Math.PI/180)*
//                     forceArrowLength
//                   }
//                   cy={
//                     210+
//                     Math.sin(forceAngle*Math.PI/180)*
//                     forceArrowLength
//                   }
//                   r="5"
//                   fill={directionOk?'#c9ff4d':'#ff5964'}
//                 />
//               </>
//             )}

//             {/* spacecraft */}
//             <rect
//               x="205"
//               y="155"
//               width="110"
//               height="110"
//               rx="8"
//               fill="#111917"
//               stroke="#758078"
//               strokeWidth="2"
//             />

//             <rect
//               x="225"
//               y="175"
//               width="70"
//               height="70"
//               fill="#18231f"
//               stroke="#34403a"
//             />

//             <text
//               x="260"
//               y="214"
//               textAnchor="middle"
//               fill="#f4f7ef"
//               fontSize="11"
//               letterSpacing="2"
//             >
//               SAT 421
//             </text>

//             {/* pods */}
//             {pods.map(p=>{
//               const rad=(p.angle-90)*Math.PI/180;

//               const cx=260+Math.cos(rad)*170;
//               const cy=210+Math.sin(rad)*170;

//               const selectedPod=selected.includes(p.id);
//               const isDegraded=degraded.includes(p.id);

//               const colour=
//                 isDegraded
//                   ?'#ff5964'
//                   :selectedPod
//                     ?'#c9ff4d'
//                     :'#738079';

//               const plumeLength=
//                 selectedPod
//                   ?isDegraded?38:58
//                   :0;

//               const px=cx-Math.cos(rad)*plumeLength;
//               const py=cy-Math.sin(rad)*plumeLength;

//               return (
//                 <g
//                   key={p.id}
//                   onClick={()=>toggle(p.id)}
//                   style={{cursor:executed?'default':'pointer'}}
//                 >
//                   {selectedPod&&(
//                     <line
//                       x1={cx}
//                       y1={cy}
//                       x2={px}
//                       y2={py}
//                       stroke={
//                         isDegraded
//                           ?'#ff5964'
//                           :'#55b6ff'
//                       }
//                       strokeWidth="12"
//                       opacity=".18"
//                       filter="url(#thrusterGlow)"
//                     />
//                   )}

//                   {selectedPod&&(
//                     <line
//                       x1={cx}
//                       y1={cy}
//                       x2={px}
//                       y2={py}
//                       stroke={
//                         isDegraded
//                           ?'#ff5964'
//                           :'#55b6ff'
//                       }
//                       strokeWidth="5"
//                       strokeLinecap="round"
//                     />
//                   )}

//                   <rect
//                     x={cx-27}
//                     y={cy-18}
//                     width="54"
//                     height="36"
//                     rx="4"
//                     fill={selectedPod?'#f4f7ef':'#101614'}
//                     stroke={colour}
//                     strokeWidth="2"
//                   />

//                   <text
//                     x={cx}
//                     y={cy+4}
//                     textAnchor="middle"
//                     fill={selectedPod?'#070809':colour}
//                     fontSize="11"
//                     fontWeight="bold"
//                   >
//                     {p.id}
//                   </text>

//                   <text
//                     x={cx}
//                     y={cy+32}
//                     textAnchor="middle"
//                     fill={isDegraded?'#ff5964':'#69746e'}
//                     fontSize="8"
//                   >
//                     {isDegraded?'DEGRADED':'NOMINAL'}
//                   </text>
//                 </g>
//               );
//             })}

//             {/* target label */}
//             <text
//               x="260"
//               y="28"
//               textAnchor="middle"
//               fill="#ffd166"
//               fontSize="10"
//               letterSpacing="2"
//             >
//               TARGET {target.label}
//             </text>

//             {/* net force label */}
//             <text
//               x="260"
//               y="405"
//               textAnchor="middle"
//               fill={directionOk?'#c9ff4d':'#ff5964'}
//               fontSize="10"
//             >
//               {values.magnitude
//                 ?`NET FORCE ${forceAngle.toFixed(0)}°`
//                 :'NO THRUST SELECTED'
//               }
//             </text>
//           </svg>
//         </div>

//         <div>
//           <div
//             className="eyebrow"
//             style={{marginBottom:12}}
//           >
//             TARGET VECTOR
//           </div>

//           <div className="readout">
//             {target.label}
//           </div>

//           <div
//             style={{
//               display:'grid',
//               gap:12,
//               marginTop:20
//             }}
//           >
//             <div
//               style={{
//                 border:'1px solid #34403a',
//                 padding:12
//               }}
//             >
//               <div className="eyebrow">REQUIRED THRUST</div>
//               <div style={{marginTop:6}}>
//                 {targetThrust}%
//               </div>
//             </div>

//             <div
//               style={{
//                 border:'1px solid #34403a',
//                 padding:12
//               }}
//             >
//               <div className="eyebrow">MAX TORQUE</div>
//               <div style={{marginTop:6}}>
//                 {maxTorque}%
//               </div>
//             </div>
//           </div>

//           <div className="rule"/>

//           <div className="eyebrow">
//             LIVE SOLUTION
//           </div>

//           <div style={{marginTop:14}}>
//             <div
//               style={{
//                 display:'flex',
//                 justifyContent:'space-between',
//                 marginBottom:6,
//                 fontSize:11
//               }}
//             >
//               <span>NET THRUST</span>
//               <span
//                 style={{
//                   color:thrustOk
//                     ?'var(--green)'
//                     :'var(--yellow)'
//                 }}
//               >
//                 {values.thrustPercent.toFixed(0)}%
//               </span>
//             </div>

//             <div className="bar">
//               <i
//                 style={{
//                   width:`${Math.min(100,values.thrustPercent)}%`,
//                   background:thrustOk
//                     ?'var(--green)'
//                     :'var(--yellow)'
//                 }}
//               />
//             </div>

//             <div
//               style={{
//                 display:'flex',
//                 justifyContent:'space-between',
//                 marginBottom:6,
//                 fontSize:11
//               }}
//             >
//               <span>VECTOR ERROR</span>
//               <span
//                 style={{
//                   color:directionOk
//                     ?'var(--green)'
//                     :'var(--red)'
//                 }}
//               >
//                 {values.angleError.toFixed(1)}°
//               </span>
//             </div>

//             <div className="bar">
//               <i
//                 style={{
//                   width:`${Math.min(100,values.angleError*3)}%`,
//                   background:directionOk
//                     ?'var(--green)'
//                     :'var(--red)'
//                 }}
//               />
//             </div>

//             <div
//               style={{
//                 display:'flex',
//                 justifyContent:'space-between',
//                 marginBottom:6,
//                 fontSize:11
//               }}
//             >
//               <span>ROTATIONAL TORQUE</span>
//               <span
//                 style={{
//                   color:torqueOk
//                     ?'var(--green)'
//                     :'var(--red)'
//                 }}
//               >
//                 {(Math.abs(values.torque)*10).toFixed(1)}%
//               </span>
//             </div>

//             <div className="bar">
//               <i
//                 style={{
//                   width:`${Math.min(100,Math.abs(values.torque)*10)}%`,
//                   background:torqueOk
//                     ?'var(--green)'
//                     :'var(--red)'
//                 }}
//               />
//             </div>
//           </div>

//           <div className="rule"/>

//           <div className="eyebrow">
//             SELECTED PODS
//           </div>

//           <div
//             style={{
//               marginTop:10,
//               color:'#dbe5dc',
//               fontSize:12,
//               lineHeight:1.8
//             }}
//           >
//             {selected.length
//               ?selected.join(' · ')
//               :'NONE'
//             }
//           </div>

//           <div className="actions">
//             <button
//               className="action"
//               onClick={reset}
//               disabled={executed}
//             >
//               RESET PATTERN
//             </button>

//             <button
//               className="action"
//               onClick={execute}
//               disabled={!safe||executed}
//               style={{
//                 opacity:safe&&!executed?1:.35
//               }}
//             >
//               EXECUTE BURN
//             </button>
//           </div>
//         </div>
//       </div>

//       <div className="legend">
//         <span>
//           <i className="dot green"/>
//           SELECTED
//         </span>

//         <span>
//           <i className="dot redbg"/>
//           DEGRADED
//         </span>

//         <span>
//           <i className="dot yellowbg"/>
//           TARGET VECTOR
//         </span>
//       </div>

//       <Result ok={executed}>
//         {executed
//           ?'BURN COMPLETE · NET FORCE ACCEPTED · ATTITUDE STABLE'
//           :status
//         }
//       </Result>
//     </>
//   );
// }

// function Sensor(){
//   const [pick,setPick]=useState(null);

//   const [fault]=useState(
//     ()=>shuffle(['A','B','C'])[0]
//   );

//   const [vals]=useState(()=>{
//     const out={A:71,B:71,C:71};
//     out[fault]=88+Math.floor(Math.random()*9);
//     return out;
//   });

//   return (
//     <>
//       <Header
//         title="SENSOR FAULT"
//         sub="TEMPERATURE STREAMS DISAGREE"
//       />

//       <p className="instructions">
//         Compare the redundant sensors.
//         Select the outlier and switch it offline.
//       </p>

//       <div className="pixel-grid">
//         {['A','B','C'].map(x=>(
//           <button
//             className={
//               'node '+(
//                 pick===x
//                   ?(x===fault?'done':'fail')
//                   :''
//               )
//             }
//             onClick={()=>setPick(x)}
//             key={x}
//           >
//             SENSOR {x}
//             <br/>
//             <small>{vals[x]}°C</small>
//           </button>
//         ))}
//       </div>

//       <Result ok={pick===fault}>
//         {pick===fault
//           ?`SENSOR ${fault} ISOLATED · CONSENSUS RESTORED`
//           :'One stream is statistically abnormal.'
//         }
//       </Result>
//     </>
//   );
// }

// function Attitude(){
//   const [a,setA]=useState(-28);
//   const ok=Math.abs(a)<=3;

//   return (
//     <>
//       <Header
//         title="ATTITUDE DRIFT"
//         sub="POINTING ERROR 28° · ANTENNA MISALIGNED"
//       />

//       <p className="instructions">
//         Use the reaction wheels to bring the antenna back
//         to Earth-pointing. Stop inside the narrow lock window.
//       </p>

//       <div className="readout">{a}°</div>

//       <input
//         className="range"
//         type="range"
//         min="-90"
//         max="90"
//         value={a}
//         onChange={e=>setA(+e.target.value)}
//       />

//       <Result ok={ok}>
//         {ok
//           ?'ATTITUDE LOCKED · DOWNLINK READY'
//           :'Fine-tune the pointing error to ±3°.'
//         }
//       </Result>
//     </>
//   );
// }

// function Battery(){
//   const [cells,setCells]=useState([92,48,76]);
//   const ok=Math.max(...cells)-Math.min(...cells)<10;

//   return (
//     <>
//       <Header
//         title="BATTERY CELLS"
//         sub="CELL IMBALANCE · BUS PROTECTION ACTIVE"
//       />

//       <p className="instructions">
//         Click the highest cell to bleed charge into the lowest cell.
//         Balance all three without dropping below 40%.
//       </p>

//       <div className="pixel-grid">
//         {cells.map((n,i)=>(
//           <button
//             className={'cell '+(ok?'done':'')}
//             onClick={()=>{
//               const hi=cells.indexOf(Math.max(...cells));
//               const lo=cells.indexOf(Math.min(...cells));

//               if(
//                 n===cells[hi]&&
//                 n-cells[lo]>2
//               ){
//                 const c=[...cells];
//                 c[hi]-=4;
//                 c[lo]+=4;
//                 setCells(c);
//               }
//             }}
//             key={i}
//           >
//             CELL {i+1}
//             <br/>
//             <b>{n}%</b>
//           </button>
//         ))}
//       </div>

//       <Result ok={ok}>
//         {ok
//           ?'CELL BALANCE RESTORED · BATTERY ONLINE'
//           :'Select the highest cell repeatedly to balance the pack.'
//         }
//       </Result>
//     </>
//   );
// }

// function Impact(){
//   const [pick,setPick]=useState(null);

//   const [fault]=useState(
//     ()=>shuffle([
//       'COMMS',
//       'POWER',
//       'THERMAL',
//       'PAYLOAD',
//       'GUIDANCE',
//       'BATTERY'
//     ])[0]
//   );

//   return (
//     <>
//       <Header
//         title="MODULE IMPACT"
//         sub="PRESSURE LOSS · STRUCTURAL BREACH DETECTED"
//       />

//       <p className="instructions">
//         Isolate the damaged module before the pressure loss spreads.
//         The breach location varies by incident.
//       </p>

//       <div className="pixel-grid">
//         {[
//           'COMMS',
//           'POWER',
//           'THERMAL',
//           'PAYLOAD',
//           'GUIDANCE',
//           'BATTERY'
//         ].map(x=>(
//           <button
//             className={
//               'module '+(
//                 pick===x
//                   ?(x===fault?'done':'fail')
//                   :''
//               )
//             }
//             onClick={()=>setPick(x)}
//             key={x}
//           >
//             {x}
//           </button>
//         ))}
//       </div>

//       <Result ok={pick===fault}>
//         {pick===fault
//           ?'MODULE ISOLATED · PRESSURE STABLE'
//           :'Trace the pressure-loss indicator to the damaged module.'
//         }
//       </Result>
//     </>
//   );
// }

// function Radiation(){
//   const [t,setT]=useState(0);

//   useEffect(()=>{
//     if(t>0){
//       const id=setTimeout(
//         ()=>setT(t-1),
//         1000
//       );

//       return()=>clearTimeout(id);
//     }
//   },[t]);

//   return (
//     <>
//       <Header
//         title="RADIATION EVENT"
//         sub="SOLAR PARTICLE FLUX ELEVATED"
//       />

//       <p className="instructions">
//         This is a transient event.
//         Enter shielding protocol, then wait.
//         Intervening too early risks unnecessary degradation.
//       </p>

//       <div className="readout">
//         {t?`FLUX FALLING · ${t}s`:'FLUX NOMINAL'}
//       </div>

//       <button
//         className="action"
//         onClick={()=>setT(8)}
//         disabled={t>0}
//       >
//         {t?'WAITING FOR CLEAR':'ENTER SHIELDING PROTOCOL'}
//       </button>
//     </>
//   );
// }

// function App(){
//   const requested=
//     new URLSearchParams(location.search).get('type');

//   const [type,setType]=useState(
//     games.some(g=>g[0]===requested)
//       ?requested
//       :'thermal'
//   );

//   const C={
//     thermal:Thermal,
//     power:Power,
//     solar:Solar,
//     contact:Contact,
//     comms:Comms,
//     process:Process,
//     thruster:ThrusterArray,
//     sensor:Sensor,
//     attitude:Attitude,
//     battery:Battery,
//     impact:Impact,
//     radiation:Radiation
//   }[type];

//   return (
//     <Frame
//       type={type}
//       setType={setType}
//     >
//       <C/>
//     </Frame>
//   );
// }

// ReactDOM
//   .createRoot(document.getElementById('root'))
//   .render(<App/>);