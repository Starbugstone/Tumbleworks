import {VillageAdmissibilityError} from './village-contact';
import { CarriageBrake } from './village-carriage-guide';
export interface CarryReceipt {readonly movingMass:number;readonly length:number;readonly duration:number;readonly sourceEnergy:number;readonly sourceRatio:number;readonly reflectedMass:number;readonly effectiveMass:number;readonly governorForceRange:readonly[number,number];readonly minimumLineTension:number;readonly potential:number;readonly governorWork:number;readonly requiredSite:'moving-carriage-guide';readonly existingSlotRelativeSpeed:0;readonly existingJournalRelativeSpeed:0}
export function carryReceipt(movingMass:number,travel:readonly[number,number,number],duration:number,sourceEnergy:number,weightMass:number):CarryReceipt{
 const length=Math.hypot(...travel),ratio=sourceEnergy/(weightMass*9.81),effectiveMass=movingMass*length**2+weightMass*ratio**2,potential=movingMass*9.81*travel[1],inertia=effectiveMass*6/duration**2;
 return Object.freeze({movingMass,length,duration,sourceEnergy,sourceRatio:ratio,reflectedMass:weightMass*(ratio/length)**2,effectiveMass,
 governorForceRange:Object.freeze([(sourceEnergy-potential-inertia)/length,(sourceEnergy-potential+inertia)/length]as const),minimumLineTension:weightMass*(9.81-ratio*6/duration**2),potential,governorWork:sourceEnergy-potential,requiredSite:'moving-carriage-guide',existingSlotRelativeSpeed:0,existingJournalRelativeSpeed:0});
}
export class VillageCarryAdmissibilityError extends VillageAdmissibilityError {
 constructor(stop:number,readonly receipt:CarryReceipt){super(stop,'carry-governor','unsupported-contact-geometry',1,0,'Positive dissipation requires a brake on the moving carriage guide; the enrolled slot and journal are stationary relative to the carriage');}
}
export function assertCarryGovernor(stop:number,receipt:CarryReceipt,brake?:CarriageBrake):void{
 if(receipt.governorForceRange[0]<0)throw new VillageAdmissibilityError(stop,'carry','drive-force',-receipt.governorForceRange[0],0);
 if(!(receipt.minimumLineTension>0))throw new VillageAdmissibilityError(stop,'carry','line-tension',Number.EPSILON,receipt.minimumLineTension);
 if(receipt.governorWork>0&&!CarriageBrake.certified(brake,stop))throw new VillageCarryAdmissibilityError(stop,receipt);
 if(brake&&receipt.governorForceRange[1]>brake.capacity)throw new VillageAdmissibilityError(stop,'carry','governor-capacity',receipt.governorForceRange[1],brake.capacity);
}

export interface CarryTiming {
 readonly duration:number;readonly binding:'acceleration-field'|'source-onset'|'governor-capacity'|'line-tension';
 readonly roundingSteps:number;readonly receipt:CarryReceipt;readonly hold:number;readonly capacity:number;
}
/** Timing is a necessary scalar proof, not guide/jaw or full wrench enrolment. */
export function solveCarryTiming(stop:number,movingMass:number,travel:readonly[number,number,number],accelerationBound:number,sourceEnergy:number,weightMass:number,capacity:number):CarryTiming {
 if(![movingMass,...travel,accelerationBound,sourceEnergy,weightMass,capacity].every(Number.isFinite)||movingMass<=0||accelerationBound<=0||sourceEnergy<=0||weightMass<=0||capacity<=0)throw new VillageAdmissibilityError(stop,'carry','unsupported-contact-geometry',1,0);
 const length=Math.hypot(...travel);if(length===0)throw new VillageAdmissibilityError(stop,'carry','unsupported-contact-geometry',1,0);
 const seed=carryReceipt(movingMass,travel,1,sourceEnergy,weightMass),drive=sourceEnergy-seed.potential,margin=capacity*length-drive;
 if(drive<=0)throw new VillageAdmissibilityError(stop,'carry','drive-force',seed.potential,sourceEnergy);
 if(margin<=0)throw new VillageAdmissibilityError(stop,'carry','governor-capacity',drive/length,capacity);
 const hold=movingMass*9.81*travel[1]/length;
 if(Math.abs(hold)>capacity)throw new VillageAdmissibilityError(stop,'carry-hold','hold-bound',Math.abs(hold),capacity);
 const bounds=[Math.sqrt(6*length/accelerationBound),Math.sqrt(6*seed.effectiveMass/drive),Math.sqrt(6*seed.effectiveMass/margin),Math.sqrt(6*seed.sourceRatio/9.81)];
 const labels=['acceleration-field','source-onset','governor-capacity','line-tension']as const;
 let duration=Math.max(...bounds),roundingSteps=0,receipt=carryReceipt(movingMass,travel,duration,sourceEnergy,weightMass);
 const valid=()=>6*length/duration**2<=accelerationBound&&receipt.governorForceRange[0]>=0&&receipt.governorForceRange[1]<=capacity&&receipt.minimumLineTension>0;
 const bits=new DataView(new ArrayBuffer(8));
 while(!valid()&&roundingSteps<8){bits.setFloat64(0,duration);bits.setBigUint64(0,bits.getBigUint64(0)+1n);duration=bits.getFloat64(0);roundingSteps++;receipt=carryReceipt(movingMass,travel,duration,sourceEnergy,weightMass);}
 if(!valid())throw new VillageAdmissibilityError(stop,'carry','drive-force',1,0,'Eight-ulp rounding limit exceeded');
 return Object.freeze({duration,binding:labels[bounds.indexOf(Math.max(...bounds))]!,roundingSteps,receipt,hold,capacity});
}
