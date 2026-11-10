/** Root-selected G-R58 profile. Shared by actual slider and carrier rail builders. */
export const CAPTIVE_SLOT=Object.freeze({front:-.88,back:-.92,floor:-.035,underFront:.035,underBack:.025,railTop:.055,halfX:.035});
export const WEDGE_K=(CAPTIVE_SLOT.underFront-CAPTIVE_SLOT.underBack)/(CAPTIVE_SLOT.front-CAPTIVE_SLOT.back);
export const captiveTop=(z:number)=>CAPTIVE_SLOT.underFront+WEDGE_K*(z-CAPTIVE_SLOT.front);
export const SLOT_C=1/Math.hypot(1,WEDGE_K),SLOT_S=WEDGE_K/Math.hypot(1,WEDGE_K);
