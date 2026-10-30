import numpy as np, subprocess, os, wave
SR=44100; O='/workspace/squeek_deep/assets/audio/'
def t(d): return np.arange(int(SR*d))/SR
def env(n,a=0.005,r=0.1):
    e=np.ones(n); A=int(a*SR); Rr=int(r*SR)
    if A: e[:A]=np.linspace(0,1,A)
    if Rr: e[-Rr:]*=np.linspace(1,0,Rr)
    return e
def sq(f,tt,duty=0.5): return np.where((f*tt)%1<duty,1.0,-1.0) if np.isscalar(f) else np.where((np.cumsum(f)/SR)%1<duty,1.0,-1.0)
def tri(phase): return 2*np.abs(2*(phase%1)-1)-1
def noise(n,seed=0): return np.random.RandomState(seed).uniform(-1,1,n)
def lp(x,k=0.2):
    y=np.zeros_like(x); acc=0
    for i,v in enumerate(x): acc+=k*(v-acc); y[i]=acc
    return y
def save(name,x,vol=0.6):
    x=np.clip(x/ (np.abs(x).max()+1e-9)*vol,-1,1); pcm=(x*32767).astype(np.int16)
    w=O+name+'.wav'
    with wave.open(w,'wb') as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',w,'-c:a','libvorbis','-q:a','4',O+name+'.ogg']); os.remove(w)
def sweep(f0,f1,d): tt=t(d); return np.exp(np.linspace(np.log(f0),np.log(f1),len(tt)))
# dig: crunchy noise burst + low thump
n=t(0.12); x=lp(noise(len(n),1),0.35)*np.exp(-n*30)+0.8*np.sin(2*np.pi*90*n)*np.exp(-n*25); save('dig',x)
# rock break
n=t(0.3); x=lp(noise(len(n),2),0.25)*np.exp(-n*12)+0.6*sq(sweep(140,50,0.3),n)*np.exp(-n*15)*0.5; save('break',x)
# pickup seed: quick up blip
n=t(0.09); x=sq(sweep(600,1200,0.09),n,0.25)*env(len(n),0.002,0.03); save('pickup_seed',x,0.4)
# pickup gem: sparkly 2-note arpeggio
x=np.concatenate([sq(988,t(0.06),0.25)*env(len(t(0.06)),0.002,0.02),sq(1480,t(0.12),0.25)*np.exp(-t(0.12)*20)]); save('pickup_gem',x,0.4)
# cheek full: squeaky "eep"
n=t(0.25); f=1400+500*np.sin(2*np.pi*14*n); x=np.sin(2*np.pi*np.cumsum(f)/SR)*env(len(n),0.01,0.08); save('squeak',x,0.45)
# hurt
n=t(0.25); x=sq(sweep(500,120,0.25),n,0.5)*env(len(n),0.002,0.1)+0.3*noise(len(n),3)*np.exp(-n*20); save('hurt',x)
# sell / coin
x=np.concatenate([sq(1319,t(0.07),0.5)*env(len(t(0.07)),0.002,0.01),sq(1976,t(0.25),0.5)*np.exp(-t(0.25)*10)]); save('coin',x,0.35)
# upgrade: rising arpeggio
notes=[523,659,784,1047,1319]; x=np.concatenate([sq(f,t(0.07),0.25)*env(len(t(0.07)),0.002,0.02) for f in notes]+[sq(1568,t(0.3),0.25)*np.exp(-t(0.3)*8)]); save('upgrade',x,0.35)
# ui click
n=t(0.03); x=sq(800,n,0.5)*np.exp(-n*120); save('click',x,0.3)
# basket bell
n=t(0.8); x=(np.sin(2*np.pi*880*n)+0.5*np.sin(2*np.pi*2215*n)+0.3*np.sin(2*np.pi*1320*n))*np.exp(-n*5); save('bell',x,0.4)
# earthquake: long low rumble with jolts
n=t(2.5); r=lp(noise(len(n),4),0.02)*(0.6+0.4*np.sin(2*np.pi*3*n)); r+=0.5*np.sin(2*np.pi*45*n)*(np.sin(2*np.pi*1.3*n)>0); x=r*env(len(n),0.2,0.8); save('quake',x,0.8)
# power on / off (wheel ACTIVE / IDLE)
n=t(0.9); f=sweep(80,320,0.9); x=(sq(f,n,0.3)*0.4+np.sin(2*np.pi*np.cumsum(f)/SR))*env(len(n),0.05,0.2); save('power_on',x,0.5)
n=t(0.9); f=sweep(320,50,0.9); x=(sq(f,n,0.3)*0.4+np.sin(2*np.pi*np.cumsum(f)/SR))*env(len(n),0.01,0.4); save('power_off',x,0.5)
# music loop: 8 bars @ 100bpm, A minor pentatonic, cozy-mysterious
bpm=100; beat=60/bpm; bar=4*beat
def note(fr,d,wave='tri',v=1.0):
    n=t(d)
    if fr==0: return np.zeros(len(n))
    ph=fr*n; w=tri(ph) if wave=='tri' else sq(fr,n,0.25)
    return w*env(len(n),0.005,min(0.08,d*0.5))*v
mid=lambda m: 440*2**((m-69)/12)
prog=[57,53,48,55, 57,53,50,52]  # A F C G A F D E (roots)
bass=[];arp=[];lead=[]
melody=[ [76,0,74,72, 69,0,72,74],[72,0,69,67, 65,0,67,69],[67,0,69,72,74,0,72,69],[71,0,67,0,74,72,71,67],
         [76,0,79,76, 74,0,72,74],[72,0,69,72, 77,76,74,72],[74,0,72,69,65,0,69,72],[71,0,76,0,0,0,0,0]]
for b,root in enumerate(prog):
    for k in range(4): bass.append(note(mid(root-12),beat,'tri',0.9))
    chord=[root,root+(3 if root in(57,50,52) else 4),root+7,root+12]
    for k in range(8): arp.append(note(mid(chord[k%4]+12),beat/2,'sq',0.18))
    for m in melody[b]: lead.append(note(mid(m) if m else 0,beat/2,'sq',0.28))
L=min(len(np.concatenate(bass)),len(np.concatenate(arp)),len(np.concatenate(lead)))
mix=np.concatenate(bass)[:L]+np.concatenate(arp)[:L]+np.concatenate(lead)[:L]
# soft hat
hat=np.zeros(L); hn=lp(noise(int(0.03*SR),9),0.9)*np.exp(-t(0.03)*150)
for i in range(int(L/(SR*beat/2))):
    p=int(i*SR*beat/2); hat[p:p+len(hn)]+=hn[:L-p]*0.15
save('music_loop',mix+hat,0.5)
print(sorted(os.listdir(O)))
