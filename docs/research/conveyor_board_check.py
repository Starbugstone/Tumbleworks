from functools import lru_cache
BOX=3
def run(name,sup,rec,cap):
    sup=tuple(tuple(s) for s in sup); rec=tuple(rec)
    def step(st,i):
        s,b,r,p=st
        c,n=s[i][0]
        b=dict(b); b[c]=b.get(c,0)+n
        ns=s[:i]+(s[i][1:],)+s[i+1:]
        while r<len(rec) and b.get(rec[r],0)>0:
            t=min(BOX-p,b[rec[r]]); b[rec[r]]-=t; p+=t
            if p==BOX: r+=1;p=0
        return (ns,tuple(sorted((k,v) for k,v in b.items() if v)),r,p)
    def moves(st):
        s,b,_,_=st; u=sum(v for _,v in b)
        return [i for i,x in enumerate(s) if x and u+x[0][1]<=cap]
    def won(st): return not any(st[0]) and not st[1] and st[2]==len(rec)
    @lru_cache(None)
    def canwin(st):
        m=moves(st)
        return won(st) if not m else any(canwin(step(st,i)) for i in m)
    @lru_cache(None)
    def pwin(st):  # uniform random legal taps
        m=moves(st)
        return (1.0 if won(st) else 0.0) if not m else sum(pwin(step(st,i)) for i in m)/len(m)
    wins=[];jams=[];doomed_first=[]
    def walk(st,path,doomed):
        m=moves(st)
        if not m:
            (wins if won(st) else jams).append(path)
            if not won(st) and doomed is not None: doomed_first.append((path,doomed,len(path)-doomed))
            return
        for i in m:
            n=step(st,i)
            d=doomed
            if d is None and not canwin(n): d=len(path)+1
            walk(n,path+[i],d)
    s0=(sup,(),0,0)
    walk(s0,[],None)
    L='ABCDE'
    print(f"== {name}: wins={len(wins)} jams={len(jams)} random-play win prob={pwin(s0):.2f}")
    print(" wins:",[''.join(L[i] for i in p) for p in wins][:14])
    print(" openings:",{L[i]:(canwin(step(s0,i)),round(pwin(step(s0,i)),2)) for i in moves(s0)})
    import collections
    print(" taps between doomed and visible jam:",dict(collections.Counter(x[2] for x in doomed_first)))
    print(" shortest jam:",min(len(p) for p in jams), [''.join(L[i] for i in p) for p in jams if len(p)==min(len(q) for q in jams)][:6])
R=lambda *a:[x for c in a for x in (c,c)]
run("board1 scaled",[[("B",6),("R",6)],[("G",6)]],R("R","B","G"),12)
run("board2 mine",[[("R",6),("B",6)],[("R",6),("Y",6)],[("G",6)]],R("R","Y","B","R","G"),12)
run("board2 sol",[[("R",6),("B",6)],[("Y",6),("R",6)],[("G",6)]],R("R","Y","B","R","G"),12)
