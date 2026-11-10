// Exact two-pass selection for the fixed eight-by-nine journal family.
// It selects from already source-bound exact tables. It issues no geometry/native authority.
import {add,cmp,rat,type R} from '../world/rocker-foot';
export interface JournalChoice154 {readonly store:readonly[number,number];readonly distanceSquared:R}
export interface CycleSelection154 {readonly path:readonly number[];readonly maximum:R;readonly sum:R}
type Costs154=readonly(readonly(readonly(R|undefined)[])[])[];
export function selectJournalCycle154(choices:readonly(readonly JournalChoice154[])[],edges:Costs154,tick:()=>void):CycleSelection154|undefined{
 const Z=rat(0n),N=8,K=9,valid=(x:R)=>x.d>0n&&x.n>=0n;
 if(choices.length!==N||edges.length!==N)throw Error('Invalid journal cycle domain');
 for(let k=0;k<N;k++){
  if(choices[k]!.length!==K||edges[k]!.length!==K)throw Error('Invalid journal candidate count');
  for(let i=0;i<K;i++){
   tick();const c=choices[k]![i]!;
   if(!valid(c.distanceSquared)||c.store.some(v=>!Number.isFinite(v)||!Object.is(v,Math.fround(v))))throw Error('Invalid journal candidate');
   for(let j=0;j<i;j++){tick();const p=choices[k]![j]!.store;if(Object.is(p[0],c.store[0])&&Object.is(p[1],c.store[1]))throw Error('Duplicate journal candidate');}
   if(edges[k]![i]!.length!==K)throw Error('Invalid journal edge domain');
   for(const e of edges[k]![i]!){tick();if(e&&!valid(e))throw Error('Invalid journal edge cost');}
  }
 }
 const edge=(k:number,a:number,b:number)=>{tick();return edges[k]![a]![b];};
 const maximum=(a:R,b:R)=>{tick();return cmp(a,b)>=0?a:b;};
 const empty=<T>()=>Array.from({length:K},()=>{tick();return undefined as T|undefined;});
 // Pass1 first tries a certified lower bound. Every closed cycle uses one
 // edge per layer, hence max(layer minimum) <= its bottleneck. A full-cycle
 // reachability witness at that exact threshold proves equality. If it has
 // no cycle, use the general minimax DP below; never infer infeasibility.
 let lower=Z;
 for(let k=0;k<N;k++){let minimum:R|undefined;for(let a=0;a<K;a++)for(let b=0;b<K;b++){const e=edge(k,a,b);if(e){tick();if(minimum===undefined||cmp(e,minimum)<0)minimum=e;}}if(minimum===undefined)return undefined;lower=maximum(lower,minimum);}
 const allowed=(limit:R)=>Array.from({length:N},(_,k)=>Array.from({length:K},(_,a)=>{tick();const list:{b:number;e:R}[]=[];for(let b=0;b<K;b++){const e=edge(k,a,b);tick();if(e&&cmp(e,limit)<=0){tick();list.push({b,e});}}return list;}));
 const lowEdges=allowed(lower);let reachable=Array.from({length:K},(_,i)=>{tick();return 1<<i;});
 for(let k=0;k<N;k++){const next=Array.from({length:K},()=>{tick();return 0;});for(let a=0;a<K;a++){tick();if(!reachable[a])continue;for(const{b}of lowEdges[k]![a]!){tick();next[b]!|=reachable[a]!;}}reachable=next;}
 let limit:R|undefined=reachable.some((mask,i)=>{tick();return(mask&(1<<i))!==0;})?lower:undefined;
 if(limit===undefined)for(let start=0;start<K;start++){
  let row=empty<R>();tick();row[start]=Z;
  for(let k=1;k<N;k++){
   const next=empty<R>();
   for(let a=0;a<K;a++)if(row[a]!==undefined)for(let b=0;b<K;b++){
    const e=edge(k-1,a,b);if(!e)continue;const v=maximum(row[a]!,e);tick();
    if(next[b]===undefined||cmp(v,next[b]!)<0){tick();next[b]=v;}
   }
   row=next;
  }
  for(let last=0;last<K;last++)if(row[last]!==undefined){
   const e=edge(N-1,last,start);if(!e)continue;const v=maximum(row[last]!,e);tick();
   if(limit===undefined||cmp(v,limit)<0){tick();limit=v;}
  }
 }
 if(limit===undefined)return undefined;
 tick();const admissible=cmp(limit,lower)===0?lowEdges:allowed(limit);
 // Pass2: fixed optimal bottleneck; only additive costs remain, so one best
 // prefix per state is safe. Complete-path coordinate ties are explicit.
 type State={sum:R;path:number[]};
 const lex=(a:readonly number[],b:readonly number[])=>{
  for(let k=0;k<a.length;k++){const x=choices[k]![a[k]!]!.store,y=choices[k]![b[k]!]!.store;
   for(let j=0;j<2;j++){tick();if(!Object.is(x[j],y[j]))return x[j]===y[j]?(Object.is(x[j],-0)?-1:1):x[j]!<y[j]!?-1:1;}}
  return 0;
 };
 const append=(path:readonly number[],v:number)=>{const p:number[]=[];for(const i of path){tick();p.push(i);}tick();p.push(v);return p;};
 let best:State|undefined;
 for(let start=0;start<K;start++){
  let row=empty<State>();tick();row[start]={sum:choices[0]![start]!.distanceSquared,path:[start]};
  for(let k=1;k<N;k++){
   const next=empty<State>();
   for(let a=0;a<K;a++){const prior=row[a];if(!prior)continue;for(const{b}of admissible[k-1]![a]!){tick();
    tick();const sum=add(prior.sum,choices[k]![b]!.distanceSquared),current=next[b];tick();
    if(current&&cmp(sum,current.sum)>0)continue;
    const path=append(prior.path,b);
    if(!current||cmp(sum,current.sum)<0||lex(path,current.path)<0){tick();next[b]={sum,path};}
   }}
   row=next;
  }
  for(let last=0;last<K;last++){const current=row[last];if(!current)continue;const e=edge(N-1,last,start);tick();if(!e||cmp(e,limit)>0)continue;tick();
   if(!best||cmp(current.sum,best.sum)<0||cmp(current.sum,best.sum)===0&&lex(current.path,best.path)<0){tick();best=current;}}
 }
 if(!best)throw Error('Inconsistent journal bottleneck passes');
 // Independent selected-path revalidation is still only graph validation;
 // actual shape/convexity/lineage/native/whole-sector proofs remain mandatory.
 let max=Z,sum=Z;
 for(let k=0;k<N;k++){const e=edge(k,best.path[k]!,best.path[(k+1)%N]!);if(!e)throw Error('Invalid selected journal edge');max=maximum(max,e);tick();sum=add(sum,choices[k]![best.path[k]!]!.distanceSquared);}
 tick();if(cmp(max,limit)!==0||cmp(sum,best.sum)!==0)throw Error('Changed selected journal table');
 const selected:number[]=[];for(const i of best.path){tick();selected.push(i);}
 tick();const bound=Object.freeze(rat(max.n,max.d));tick();const deviation=Object.freeze(rat(sum.n,sum.d));
 tick();return Object.freeze({path:Object.freeze(selected),maximum:bound,sum:deviation});
}
