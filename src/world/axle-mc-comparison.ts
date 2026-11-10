// Pure arithmetic classifier, NEVER a native issuer or source-bound proof.
// Every operand must first be derived from the real private model/native/reference.
import {cmp,mul,rat,type R} from './rocker-foot';

export type MCDecision = 'proved-by-enclosures'|'counterexample'|'indeterminate';
export interface MCOperands {
  readonly candidateUpper:R;
  readonly candidateWitnessSquared?:R;
  readonly referenceWitnessSquared:R;
  readonly referenceUpper:R;
}
export function compareMC(x:MCOperands):MCDecision {
  const z=rat(0n),values=[x.candidateUpper,x.referenceWitnessSquared,x.referenceUpper,
    ...(x.candidateWitnessSquared?[x.candidateWitnessSquared]:[])];
  if(values.some(v=>v.d<=0n||cmp(v,z)<0))throw Error('Invalid MC bound domain');
  const c2=mul(x.candidateUpper,x.candidateUpper),r2=mul(x.referenceUpper,x.referenceUpper);
  if(cmp(x.referenceWitnessSquared,r2)>0)throw Error('Inconsistent frozen-reference enclosure');
  if(x.candidateWitnessSquared&&cmp(x.candidateWitnessSquared,c2)>0)throw Error('Inconsistent candidate enclosure');
  if(x.candidateWitnessSquared&&cmp(x.candidateWitnessSquared,r2)>0)return 'counterexample';
  if(cmp(c2,x.referenceWitnessSquared)<=0)return 'proved-by-enclosures';
  return 'indeterminate';
}
