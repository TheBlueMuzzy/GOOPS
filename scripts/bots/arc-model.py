# Goops shift arc — a plain rate model (not the engine): pressure, crack rate, open cracks, integrity, second by second.
# Player = share of cracks sealed (f), seconds a sealed crack stays open (ts), pressure vent from zaps (popVent, s of rise per s).
import sys
def run(P, f, ts, popVent, T=300, dt=0.1):
    p=0; integ=1.0; unsealed=0.0; inflight=0.0; acc=0; t=0; t100=None; cracks=0; seals=0; hist=[]
    while t<T:
        # crack rate (per s): flat early, hockey stick at the end: r0 + (r1-r0)*p^k
        r = (P['r0'] + (P['r1']-P['r0'])*p**P['k'])/60
        new = r*dt; cracks += new
        unsealed += new*(1-f); inflight += new*f
        sealed_now = inflight*dt/ts; inflight -= sealed_now; seals += sealed_now
        open_ = unsealed+inflight
        integ += -P['d']*open_*dt + P['s']*sealed_now
        integ = min(1, integ)
        rise = dt/P['rise'] - (popVent*dt + sealed_now*P['sealVent'])/P['rise']
        p = max(0,min(1,p+rise))
        if p>=1 and t100 is None: t100=t
        t+=dt
        if integ<=0: break
        if abs(t-round(t))<dt/2 and round(t)%15==0: hist.append((round(t),p,open_,integ,cracks))
    return dict(rupture=t, t100=t100, cracks=cracks, seals=seals, hist=hist)
P=dict(r0=float(sys.argv[1]), r1=float(sys.argv[2]), k=float(sys.argv[3]), d=float(sys.argv[4]), s=float(sys.argv[5]), sealVent=float(sys.argv[6]), rise=75)
players={'idle':(0,11,0),'casual':(0.1,14,0.04),'good':(0.55,11,0.05),'sharp':(0.65,10,0.06)}
print('params',P)
for n,(f,ts,pv) in players.items():
    R=run(P,f,ts,pv)
    t100=f"{R['t100']:.0f}s" if R['t100'] else 'never'
    print(f"{n:7s} rupture {R['rupture']:5.0f}s  100% at {t100:6s} cracks {R['cracks']:4.1f} seals {R['seals']:4.1f}  plateau {R['rupture']-(R['t100'] or R['rupture']):4.0f}s")
    if n in ('good','idle'): print('   t  pressure open integrity cracks:', ' | '.join(f"{a}s {b:.0%} {c:.1f} {e:.0%} {g:.0f}" for a,b,c,e,g in R['hist']))
