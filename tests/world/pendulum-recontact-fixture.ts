// UNUSED phase-only fixture. No village registry or WorldScene import.
import{pendulumParts}from'../../src/view/pendulum-parts';
import{PendulumCore}from'../../src/world/pendulum-core';
import{PendulumProfile}from'../../src/world/pendulum-profile';
import{proposedPendulum}from'./pendulum-fields';
import{pendulumStation}from'./pendulum-fixture';
export function recontactFixture(friction=.012){
 const drive=proposedPendulum({...pendulumStation,strikerDrive:{mass:.001,inertia:.000095,friction,stroke:.5}},'mill-paddle',()=>0),parts=pendulumParts(pendulumStation,drive,()=>0),profile=new PendulumProfile(parts.bar,-.3,1.6),core=new PendulumCore(7,drive,parts,profile);
 return{drive,parts,profile,core,dispose:()=>parts.parts.forEach(p=>p.geometry.dispose())};
}
