import{axleSpliceGeometry,axleSpliceSource}from'./axle-splice';
import{HarbourStaticConstruction,type PostOwner}from'./harbour-static-construction';
import{StaticProofOwner,type StaticProofBackend}from'./static-proof-owner';
import{drain,type TaskScheduler}from'./cooperative';
import {AxleLand}from'./axle-ground';
import {AxleDrawBinding}from'./axle-draw';
import {axleParts}from'./axle-parts';
import type{AxleStation}from'../world/axle-types';
import { TerrainFootGround, terrainPlankPile, terrainFootDescriptor, bindTerrainFoot, verifyTerrainFoot, type TerrainFootBinding } from './terrain-foot';
import { connectorSupportFrames, type VillageConnector } from '../world/village-plan';
import{relativeSceneMatrix}from'./gravity-rocker-native';
import{gravityHingeParts}from'./gravity-hinge-parts';
import type{NativeHingePart,NativeGroundFace}from'../world/gravity-hinge-support';
import type{CarrierWeldId,CarrierWeldPart}from'../world/village-captive-welds';
import{trimEnclosedCaps}from'./captive-enclosed-caps';
import {captiveRenderGeometry,trimCoveredPlanes} from './captive-weld-trims';
import {pendulumParts,pendulumFrame,pendulumRenderGeometry} from './pendulum-parts';
import {retainerParts} from './retainer-parts';
import { openGuideGeometry } from './open-lock-parts';
import { compactCylinderCaps } from './cylinder-caps';
import { terminalGuideParts, TERMINAL_GUIDE_MARGIN } from './terminal-guide-parts';
import { carriageGuideParts } from './carriage-guide-parts';
import { postBraceGeometry, slotLegGeometry, captiveSlotCornerGeometry } from './retained-support';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { counterweightGeometry, groundedGuideGeometry, sourceMountLayout } from './counterweight';
import {cinematicSource,type CinematicSource}from'./cinematic-source';
import {VILLAGE_SHAPES}from'../world/village-shapes';
import{cinematicClockWheel,cinematicClockFollower}from'./cinematic-clock';
import{VillageCinematic}from'../world/village-cinematic';
import type{VillageRoute,VillageMotionMode}from'../world/village-motion';
import { VillageProgram } from '../world/village-program';
import { VillageTerminalPath } from '../world/village-terminal';
import type { VillageAuxiliary, VillageAuxiliaryPose } from '../world/village-motion';
import { VILLAGE_RADIUS, villagePort, type VillagePlan, type VillagePort, type VillageStation, type VillageProfile, type VillageVec3 } from '../world/village-plan';
import { carrierContact, hasVillageCarrier, isVillageTrack, mechanismMatrix, villageEase, villageChannelGeometry, villageSpanGeometry, villageFloorDepth, villageBearingCap } from './machine-primitives';

type Assets = { model(name: string, material: THREE.Material): THREE.Group };
interface Mover { readonly group: THREE.Group; readonly station: VillageStation; readonly auxiliary?: VillageAuxiliary; readonly carrierLocal?: boolean; rest?: THREE.Matrix4; }

/** Packed vertices in the mover's own frame, independent of parent anchors/poses. */
function packedLocalBounds(root: THREE.Group): THREE.Box3 {
  const box=new THREE.Box3(),point=new THREE.Vector3();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const matrix=new THREE.Matrix4();
    for(let part:THREE.Object3D|null=object;part&&part!==root;part=part.parent){
      if(part.matrixAutoUpdate)part.updateMatrix();
      matrix.premultiply(part.matrix);
    }
    const p=object.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++)box.expandByPoint(point.fromBufferAttribute(p,i).applyMatrix4(matrix));
  });
  return box;
}

function dockingTravel(station: VillageStation): VillageVec3 | undefined {
  const mechanism = station.mechanism;
  if (mechanism.kind !== 'translating' || mechanism.travel[0] !== 0 || mechanism.travel[2] !== 0
    || mechanism.travel[1] === 0 || !mechanism.deckPitch) return undefined;
  return mechanism.travel;
}

/** Owns procedural geometry only. Shared asset geometry and caller material remain borrowed. */
export class VillageMachine {
  get physicalLedger(){return this.program?.physicalLedger;}
  marbleOrientation(seconds:number,target:THREE.Quaternion):void{this.route.marbleOrientation(seconds,target);}
  readonly root = new THREE.Group();
  readonly groups: readonly THREE.Group[];
  readonly staticSolids: readonly THREE.Group[];
  readonly route: VillageRoute;
  readonly program?:VillageProgram;
  get triangles(): number { return this.triangleCount; }
  get movingGroups(): number { return this.movingGroupCount; }
  private triangleCount = 0;
  private movingGroupCount = 0;
  private pending?: Generator<unknown, void, void>;
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly movers: Mover[] = [];
  private readonly rockerBindings=new Map<number,{parts:(NativeHingePart&{sourceMesh:THREE.Mesh})[];carrier:THREE.Group;fixed:THREE.Group}>();
  private readonly stationBounds = new Map<number, THREE.Box3>();
  private readonly wholeBounds = new THREE.Box3();
  private readonly matrix = new THREE.Matrix4();
  private readonly carrierMatrix = new THREE.Matrix4();
  private readonly auxiliaryPose: VillageAuxiliaryPose = { angle: 0, x: 0, y: 0, z: 0 };
  private readonly scratch = new THREE.Vector3();
  private disposed = false;
  private staticConstruction?:HarbourStaticConstruction;
  private staticProof?:StaticProofOwner;
  private readonly footGround?: TerrainFootGround;
  readonly footBindings: TerrainFootBinding[] = [];
  verifyTerrainFeet(): readonly TerrainFootBinding[] { for(const b of this.footBindings){if(!this.footGround)throw new Error('Missing terrain-foot provider');verifyTerrainFoot(b,this.footGround);}return this.footBindings; }

  constructor(readonly plan: VillagePlan, _assets: Assets, private readonly material: THREE.Material,
    private readonly groundHeightAt: (x: number, z: number) => number | undefined, nativeGround?: THREE.Mesh,staticHome?:THREE.Object3D,construction:'sync'|'staged'='sync',motion:VillageMotionMode='physical') {
    if(motion==='physical'){this.program=new VillageProgram(plan);this.route=this.program;}else this.route=new VillageCinematic(plan);
    if(plan.stations.some(s=>s.mechanism.kind==='wheelbucket'&&s.mechanism.axleCarry)){if(!nativeGround)throw new Error('Axle needs actual WorldScene land before frame construction');this.axleLand=new AxleLand(nativeGround);}
    if(plan.stations.some(s=>s.terrainFeet!==undefined)||plan.connectors.some(l=>l.terrainFeet!==undefined||l.terrainFrameFeet!==undefined)){if(!nativeGround)throw new Error('Terrain feet require the actual native ground provider');this.footGround=new TerrainFootGround(nativeGround,groundHeightAt);}
    if(plan.staticSupports!==undefined){if(!nativeGround||!staticHome)throw Error('Actual static home/ground required');staticHome.add(this.root);this.staticConstruction=new HarbourStaticConstruction(plan,staticHome,nativeGround);}
    const ground = (position: readonly [number, number, number]): boolean => {
      const height = groundHeightAt(position[0], position[2]); return height !== undefined && Number.isFinite(height);
    };
    for (const station of this.route.plan.stations) {
      for (const mount of station.supports ?? []) if (!ground(mount)) throw new Error('Authored station support has no ground');
      if (station.span && (station.supports?.length ?? 0) < 2) throw new Error('Structural station span requires two authored bank supports');
      for (let step = 0; step <= 16; step++) {
        this.route.sample(station.start + (station.end - station.start) * step / 16, this.scratch);
        if (!station.span && !ground([this.scratch.x, this.scratch.y, this.scratch.z])) throw new Error('Station crosses a void without an authored supported span');
      }
    }
    for (const link of plan.connectors) {
      for (const mount of link.supports ?? []) if (!ground(mount)) throw new Error('Authored connector support has no ground');
      if (link.span && (link.supports?.length ?? 0) < 2) throw new Error('Structural connector span requires two authored bank supports');
      if (!link.span) for (let index = 1; index < link.points.length; index++) {
        const a = link.points[index - 1]!.position, b = link.points[index]!.position;
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.25));
        for (let step = 0; step <= steps; step++) {
          const t = step / steps;
          if (!ground([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])) throw new Error('Connector crosses a void without an authored supported span');
        }
      }
    }
    this.root.name = `village-machine-${plan.chapter}`;
    this.groups = Array.from({ length: 10 }, (_, stop) => { const group = new THREE.Group(); group.name = `village-stop-${stop}`; this.root.add(group); return group; });
    this.staticSolids = this.groups.map(group => { const fixed = new THREE.Group(); fixed.name = `${group.name}-static`; group.add(fixed); return fixed; });
    const steps = this.complete();
    if (construction === 'staged') this.pending = steps; else drain(steps);
  }
  /** The rest of construction, once: one bounded step per yield, in the original order. */
  construction(): Generator<unknown, void, void> { const steps = this.pending; if (!steps) throw new Error('Village machine construction already taken'); this.pending = undefined; return steps; }
  private *complete(): Generator<unknown, void, void> {
    const plan = this.plan;
    try {
    for (const station of plan.stations) { this.build(station); yield 'station:'+station.stop; }
    for (const mover of this.movers) if (mover.auxiliary) {
      mover.group.updateMatrix(); mover.rest = mover.group.matrix.clone();
      mover.group.matrixAutoUpdate = false; mover.group.matrixWorldNeedsUpdate = true;
    }
    // Compute conservative envelopes from local geometry without seeking the live scene.
    for (const station of plan.stations) {
      const box = new THREE.Box3().setFromObject(this.staticSolids[station.stop]!);
      for (const mover of this.movers.filter(m => m.station.stop === station.stop)) {
        const local = mover.carrierLocal ? new THREE.Box3(new THREE.Vector3(-.85, -.05, mover.auxiliary==='capture-head'?-.98:-.95), new THREE.Vector3(.85, 1.35, .95))
          : new THREE.Box3().setFromObject(mover.group);
        if(mover.carrierLocal&&station.retention&&this.route.retainedLayout(station.stop)==='keyed-prismatic'){
          const raw=packedLocalBounds(mover.group),first=station.retention.captureStart+.34,last=this.route.retainedForkOrigin(station.stop),low=Math.min(first,last),high=Math.max(first,last);
          if(mover.auxiliary==='fork'){
            const radius=Math.max(...[raw.min.x,raw.max.x].flatMap(x=>[raw.min.y,raw.max.y].map(y=>Math.hypot(x,y))));
            local.set(new THREE.Vector3(low-radius,-radius,raw.min.z),new THREE.Vector3(high+radius,radius,raw.max.z));
          }else{
            local.copy(raw).translate(new THREE.Vector3(low,0,0)).union(raw.clone().translate(new THREE.Vector3(high,0,0)));
            if(mover.auxiliary==='capture-head')local.union(local.clone().translate(new THREE.Vector3(0,.6,0)));
          }
        }else if(mover.carrierLocal&&station.retention&&['plank','timber'].includes(this.plan.profile)){
          // Enclose actual packed parts through the whole axle stroke, closure and lift.
          const raw=packedLocalBounds(mover.group),first=station.retention.captureStart+.34,last=this.route.retainedForkOrigin(station.stop);
          if(mover.auxiliary==='fork'){
            const radius=Math.max(...[raw.min.x,raw.max.x].flatMap(x=>[raw.min.y,raw.max.y].map(y=>Math.hypot(x,y))));
            local.set(new THREE.Vector3(Math.min(first,last)-radius,-radius,raw.min.z),new THREE.Vector3(Math.max(first,last)+radius,radius+.6,raw.max.z));
          }else local.copy(raw).translate(new THREE.Vector3(Math.min(first,last),0,0)).expandByVector(new THREE.Vector3(Math.abs(last-first),.6,0));
        }
        if(mover.auxiliary==='striker'&&station.strikerDrive?.kind==='pendulum'){
          const d=station.strikerDrive,pivot=new THREE.Vector3(...d.axle.origin),p=new THREE.Vector3();
          mover.group.traverse(o=>{if(o instanceof THREE.Mesh){const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){
            const x=a.getX(i),y=a.getY(i),z=a.getZ(i),candidates=[0,d.stopAngle,Math.atan2(-y,x),Math.atan2(-y,x)+Math.PI,Math.atan2(x,y),Math.atan2(x,y)+Math.PI];
            for(let q of candidates){q=(q+Math.PI*2)%(Math.PI*2);if(q<=d.stopAngle)box.expandByPoint(p.set(x*Math.cos(q)-y*Math.sin(q),x*Math.sin(q)+y*Math.cos(q),z).add(pivot));}
          }}});continue;
        }
        if (mover.auxiliary === 'weight') {
          box.union(local); box.union(local.clone().translate(new THREE.Vector3(0, -this.driveDistance(station), 0))); continue;
        }
        if (mover.auxiliary === 'gate') { box.union(local); box.union(local.clone().translate(new THREE.Vector3(0, 1.2, 0))); continue; }
        if (mover.auxiliary === 'damper') {
          const path=new VillageTerminalPath(station),pose=new THREE.Matrix4(),centre=new THREE.Vector3();
          const radius=local.getSize(new THREE.Vector3()).length()/2+local.getCenter(new THREE.Vector3()).distanceTo(mover.group.position);
          for(let i=0;i<=16;i++) {
            path.headPose(path.startDistance+station.terminalCapture!.availableStroke*i/16,pose);centre.setFromMatrixPosition(pose);
            box.union(new THREE.Box3(centre.clone().addScalar(-radius),centre.clone().addScalar(radius)));
          }
          continue;
        }
        if (mover.auxiliary && !mover.carrierLocal) {
          const centre = mover.group.position, radius = local.getSize(new THREE.Vector3()).length() / 2 + local.getCenter(new THREE.Vector3()).distanceTo(centre);
          box.union(new THREE.Box3(centre.clone().addScalar(-radius), centre.clone().addScalar(radius)));
          if (mover.auxiliary === 'striker') {
            const stroke = station.strikerDrive?.kind==='pendulum'?undefined:station.strikerDrive?.stroke;
            const end = centre.clone().add(new THREE.Vector3(stroke ?? 0, 0, stroke === undefined ? -1 : -2 * stroke));
            box.union(new THREE.Box3(end.clone().addScalar(-radius), end.clone().addScalar(radius)));
          }
          continue;
        }
        if(station.rollingDrive?.kind==='contact-gravity-rocker'&&'pivot'in station.mechanism){
          const m=station.mechanism,pivot=new THREE.Vector3(...m.pivot),v=new THREE.Vector3();
          mover.group.traverse(o=>{if(o instanceof THREE.Mesh){if(o.parent!==mover.group)throw new Error('Rocker bound needs explicit nested transform');const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrix).sub(pivot);const x=v.x,y=v.y,z=v.z,candidates=[m.angle,0];for(const base of[Math.atan2(-y,x),Math.atan2(x,y)])for(let k=-2;k<=2;k++){const q=base+k*Math.PI;if(q>m.angle&&q<0)candidates.push(q);}for(const q of candidates)box.expandByPoint(new THREE.Vector3(x*Math.cos(q)-y*Math.sin(q)+pivot.x+station.anchor[0],x*Math.sin(q)+y*Math.cos(q)+pivot.y+station.anchor[1],z+pivot.z+station.anchor[2]));}}});continue;
        }
        const mechanism = station.mechanism;
        if ('pivot' in mechanism) {
          const pivot = new THREE.Vector3(...mechanism.pivot), centre = pivot.clone().add(new THREE.Vector3(...station.anchor));
          let radius = 0;
          const deck = mechanismMatrix(mechanism, [0, 0, 0], 0, new THREE.Matrix4());
          for (let i = 0; i < 8; i++) radius = Math.max(radius, new THREE.Vector3(i & 1 ? local.max.x : local.min.x, i & 2 ? local.max.y : local.min.y, i & 4 ? local.max.z : local.min.z).applyMatrix4(deck).distanceTo(pivot));
          radius += mechanism.dockingLift ?? 0;
          box.union(new THREE.Box3(centre.clone().addScalar(-radius), centre.clone().addScalar(radius)));
        } else if (mechanism.kind === 'wheelbucket') {
          const centre = new THREE.Vector3(station.anchor[0], station.anchor[1] + mechanism.radius, station.anchor[2]);
          const travel = local.clone().applyMatrix4(mechanismMatrix(mechanism, [0, 0, 0], 0, new THREE.Matrix4())).translate(centre);
          travel.min.x -= mechanism.radius; travel.max.x += mechanism.radius;
          travel.min.y -= mechanism.radius; travel.max.y += mechanism.radius; box.union(travel);
        } else {
          for (const u of [0, 1]) box.union(local.clone().applyMatrix4(mechanismMatrix(mechanism, station.anchor, u, new THREE.Matrix4())));
        }
      }
      const axleEnvelope=this.axleDraw.get(station.stop);if(axleEnvelope){if(axleEnvelope.boundsPending)throw new Error('Actual axle swept ranges are not bounded');box.union(axleEnvelope.sweptBounds);}
      box.expandByPoint(new THREE.Vector3(...station.entry.position)).expandByPoint(new THREE.Vector3(...station.exit.position)).expandByScalar(VILLAGE_RADIUS);
      this.stationBounds.set(station.stop, box);
      yield 'bounds:'+station.stop;
    }
    for (const link of plan.connectors) {
      const station = plan.stations.find(s => s.stop === link.from)!;
      const receiving = plan.stations.find(s => s.stop === link.to)!;
      const selected=plan.stations.find(s=>s.mechanism.kind==='wheelbucket'&&s.mechanism.axleCarry&&(link.to===s.stop&&link.from===s.stop+1||link.from===s.stop&&link.to===s.stop-1));
      const connectorGeometry=selected?this.axleSplice(link,selected):villageChannelGeometry(link.points,plan.profile,{start:dockingTravel(station),end:dockingTravel(receiving)},link.refineFloor??false,undefined,this.staticConstruction!==undefined);
      const connectorMesh=this.mesh(this.staticSolids[link.from]!,connectorGeometry,station.color);if(selected)this.axleSplices.set(link,{source:connectorMesh,dock:link.to===selected.stop?'home':'top'});connectorMesh.name=`village-track-connector-${link.from}-${link.to}`;
      this.staticConstruction?.track({kind:'connector',connector:link},connectorMesh);
      if (link.span) this.mesh(this.staticSolids[link.from]!, villageSpanGeometry(link.points, plan.profile), 0x657578).name = `village-span-${link.from}-${link.to}`;
      if (link.span && (!link.supports || link.supports.length < 2)) throw new Error('Structural connector span requires two authored bank supports');
      if(station.mechanism.kind==='wheelbucket'&&!station.mechanism.axleCarry&&station.span&&link.supports?.length===0)
        this.buildWheelDock(station,link.points);
      if (link.supports) link.supports.forEach((mount,index)=>this.support(station,mount,true,undefined,undefined,this.plan.profile,link.terrainFeet?.includes(index)?{id:`connector-${link.from}-${link.to}-${index}`}:undefined,this.staticConstruction?{kind:'explicit',owner:{kind:'connector',connector:link},index}:undefined));
      else for (const index of link.supportIndices??connectorSupportFrames(link.points)) {
        if(link.omitAutomaticFrames?.includes(index))continue;
        const frame = link.points[index]!;
        this.support({ ...station, supports: undefined }, frame.position, false, frame, link.points, this.plan.profile,link.terrainFrameFeet?.includes(index)?{id:`automatic-${link.from}-connector-frame-${index}`,link,index,source:station,target:receiving}:undefined,this.staticConstruction?{kind:'frame',owner:{kind:'connector',connector:link},index}:undefined);
      }
      yield 'connector:'+link.from+'-'+link.to;
    }
    if(this.staticConstruction)yield* this.staticConstruction.buildSeats((post,geometry)=>{const parent=post.mesh.parent;if(!(parent instanceof THREE.Group))throw Error('Actual seat home missing');const mesh=this.mesh(parent,geometry,0x657578);mesh.name=`village-seat-${post.id}`;return mesh;});
    for (const box of this.stationBounds.values()) this.wholeBounds.union(box);
    for (const fixed of this.staticSolids) this.wholeBounds.union(new THREE.Box3().setFromObject(fixed));
    for (const fixed of this.staticSolids) { this.merge(fixed); yield 'merge:'+fixed.name; }
    for (const mover of this.movers) { this.merge(mover.group); yield 'merge:'+mover.group.name; }
    this.movingGroupCount = this.movers.length+3*this.axleDraw.size;
    let triangles = 0;
    this.root.traverse(object => { if (object instanceof THREE.Mesh) triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3; });
    this.triangleCount = triangles;
    this.apply(0); this.route.sample(0, this.scratch);
    } catch (error) { this.dispose(); throw error; }
  }
  get distance(): number { return this.route.distance; }
  sample(seconds: number, target: THREE.Vector3): void { this.route.sample(seconds, target); }
  focus(stop: number, target: THREE.Vector3): void { this.route.focus(stop, target); }
  contactBounds(stop: number, target: THREE.Box3): void {
    const bounds = this.stationBounds.get(stop); if (!bounds) throw new Error('Unknown village stop'); target.copy(bounds);
  }
  bounds(target: THREE.Box3): void { target.copy(this.wholeBounds); }
  apply(seconds: number, _reduced = false): void {
    if (!Number.isFinite(seconds)) throw new Error('Village time must be finite');
    if(this.axleDraw.size)for(const binding of this.axleDraw.values())binding.apply(seconds);
    for (const mover of this.movers) {
      if(mover.auxiliary==='damper') {
        this.route.terminalHeadPose(mover.station.stop,seconds,mover.group.matrix);
        mover.group.matrixWorldNeedsUpdate=true;continue;
      }
      if (mover.auxiliary) {
        this.route.auxiliaryPose(mover.station.stop, mover.auxiliary, seconds, this.auxiliaryPose);
        const pose = this.auxiliaryPose;
        const aroundY = mover.auxiliary === 'top' || mover.auxiliary === 'striker' && mover.station.mechanism.kind === 'escapement';
        if (aroundY) this.matrix.makeRotationY(pose.angle);
        else if(this.route.mode==='cinematic'&&mover.auxiliary==='gear')this.matrix.makeRotationX(pose.angle);
        else this.matrix.makeRotationZ(pose.angle);
        this.matrix.setPosition(pose.x, pose.y, pose.z);
        if (mover.carrierLocal) {
          this.route.carrierPose(mover.station.stop, seconds, this.carrierMatrix);
          mover.group.matrix.multiplyMatrices(this.carrierMatrix, this.matrix);
        } else mover.group.matrix.multiplyMatrices(mover.rest!, this.matrix);
        mover.group.matrixWorldNeedsUpdate = true;
      } else {
        this.route.carrierPose(mover.station.stop, seconds, this.matrix);
        mover.group.matrix.copy(this.matrix); mover.group.matrixWorldNeedsUpdate = true;
      }
    }
  }
  handoff(seconds: number, target: THREE.Vector3): void {
    if (!Number.isFinite(seconds)) throw new Error('Village time must be finite');
    if(this.route.mode==='cinematic'){
      // A closing glimpse of the preceding village reuses its real source
      // track. The old airborne arrival had no drawn chute beneath it.
      const time=Math.max(0,Math.min(2.5,seconds));this.apply(time);this.route.sample(time,target);return;
    }
    const { entry, entryTime, causeTime } = this.route.handoff;
    if (causeTime < entryTime) throw new Error('Handoff cause precedes physical entry');
    const arrival = 1;
    if (seconds < arrival) {
      const u = villageEase(Math.max(0, seconds) / arrival);
      target.set(...entry.position).addScaledVector(this.scratch.set(...entry.tangent), -7 * (1 - u));
      target.y += 0.8 * (1 - u);
      this.apply(entryTime);
      return;
    }
    // Physical travel runs at 1x after arrival, even if a long stroke outlasts this preview.
    const time = Math.min(this.route.duration, entryTime + Math.min(seconds, 2.5) - arrival);
    this.sample(time, target);
    this.apply(time);
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; this.staticProof?.dispose(); this.staticConstruction?.dispose(); this.pending?.return(); this.pending = undefined;
    this.axleDraw.forEach(b=>b.dispose());this.axleDraw.clear();
    this.geometries.forEach(g => g.dispose()); this.geometries.clear(); this.root.removeFromParent();
  }
  private mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, color: number): THREE.Mesh {
    if(geometry instanceof THREE.CylinderGeometry)compactCylinderCaps(geometry);
    geometry.deleteAttribute('uv');
    const count = geometry.getAttribute('position').count, values = new Float32Array(count * 3), rgb = new THREE.Color(color);
    for (let i = 0; i < count; i++) rgb.toArray(values, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(values, 3)); this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, this.material); mesh.name = `${parent.name}-${geometry.type}-${parent.children.length}`; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Group, position: readonly [number, number, number], size: readonly [number, number, number], color: number): void {
    this.mesh(parent, new THREE.BoxGeometry(...size).translate(...position), color);
  }
  private support(station: VillageStation, position: readonly [number, number, number], explicit = false, frame?: VillagePort, path?: readonly VillagePort[], contactProfile: VillageProfile = this.plan.profile, foot?: {readonly id:string;readonly link?:VillageConnector;readonly index?:number;readonly source?:VillageStation;readonly target?:VillageStation},ownership?:PostOwner): THREE.Mesh|undefined {
    let post:THREE.Mesh|undefined,capMesh:THREE.Mesh|undefined;
    if(foot){if(this.plan.profile!=='plank'||!this.footGround)throw new Error('Terrain foot requires plank/native provider');if(foot.link){const l=foot.link,i=foot.index!;if(!this.plan.connectors.includes(l)||!this.plan.stations.includes(foot.source!)||!this.plan.stations.includes(foot.target!)||foot.source!.stop!==l.from||foot.target!.stop!==l.to||station.mechanism!==foot.source!.mechanism||l.from!==station.stop||l.supports!==undefined||path!==l.points||frame!==l.points[i]||!connectorSupportFrames(l.points).includes(i)||!l.terrainFrameFeet?.includes(i))throw new Error('Wrong terrain-foot automatic owner/frame');}else if(!explicit||frame)throw new Error('Wrong explicit terrain-foot frame');}
    if (station.supports && !explicit && (!frame||!path||!station.supportIndices?.some(i=>path[i]===frame))) return;
    if(this.staticConstruction){if(!ownership)throw Error('Actual Harbour support owner missing');this.staticConstruction.assertPostCall(ownership,station,position,explicit,frame,path);}
    if (frame && !explicit) {
      const depth = this.plan.profile === 'twinrail'
        ? Math.sqrt((VILLAGE_RADIUS + 0.055) ** 2 - 0.22 ** 2) + 0.055 + 0.075
        : VILLAGE_RADIUS + villageFloorDepth(this.plan.profile);
      position = [position[0] - frame.normal[0] * depth, position[1] - frame.normal[1] * depth, position[2] - frame.normal[2] * depth];
      explicit = true;
    }
    const ground = this.groundHeightAt(position[0], position[2]);
    let top = explicit ? position[1] : position[1] - (this.plan.profile === 'twinrail' ? Math.sqrt((VILLAGE_RADIUS + 0.055) ** 2 - 0.22 ** 2) + 0.055 + 0.075 : VILLAGE_RADIUS + villageFloorDepth(this.plan.profile));
    if (ground === undefined || !Number.isFinite(ground)) throw new Error('Village support has no ground; author bank mounts and an explicit structural span');
    if (frame && path) {
      const at = path.indexOf(frame);
      const cap = villageBearingCap(path.slice(Math.max(0, at - 8), Math.min(path.length, at + 9)), contactProfile, frame, position, contactProfile === 'twinrail' ? 0.035 : 0.13);
      top = cap.boundingBox!.min.y;
      capMesh=this.mesh(this.staticSolids[station.stop]!, cap, 0x657578);capMesh.name = `village-bearing-cap-${station.stop}`;
    }
    if (top < ground - 1e-6) throw new Error(`Village support top is buried in terrain: stop ${station.stop} at ${position.join(',')}, top ${top}, terrain ${ground}`);
    if (top <= ground) return;
    let fixed = this.staticSolids[station.stop]!;
    const height = top - ground, y = (top + ground) / 2;
    if (frame) {
      const yaw = Math.atan2(-frame.tangent[2], frame.tangent[0]);
      const mount = new THREE.Group(); mount.name = `village-support-${station.stop}`;
      mount.matrixAutoUpdate = false;
      mount.matrix.makeTranslation(position[0], 0, position[2])
        .multiply(new THREE.Matrix4().makeRotationY(yaw))
        .multiply(new THREE.Matrix4().makeTranslation(-position[0], 0, -position[2]));
      mount.matrixWorldNeedsUpdate = true;
      fixed.add(mount); fixed = mount;
    }
    switch (this.plan.profile) {
      case 'plank':
        if(foot){
          const source=new THREE.CylinderGeometry(.09,.12,height,8).translate(position[0],y,position[2]);compactCylinderCaps(source);
          const packed=source.toNonIndexed();source.dispose();
          // Same relative-frame operation and Float32 store as the original real
          // merge. Selected yaw is baked ONCE; the cap/mount path is untouched.
          fixed.updateWorldMatrix(true,true);const home=this.staticSolids[station.stop]!;home.updateWorldMatrix(true,true);
          packed.applyMatrix4(home.matrixWorld.clone().invert().multiply(fixed.matrixWorld));
          try{post=this.mesh(home,terrainPlankPile(foot.id,packed,this.footGround!),0x82694c);post.name=`village-foot-${foot.id}`;}finally{packed.dispose();}
        }else post=this.mesh(fixed, new THREE.CylinderGeometry(0.09, 0.12, height, 8).translate(position[0], y, position[2]), 0x82694c); break;
      case 'terracotta':
        this.box(fixed, [position[0], y, position[2]], [0.38, height, 0.38], 0xa77c60); break;
      case 'timber':
        for (const side of [-1, 1]) this.box(fixed, [position[0], y - Math.min(0.06, (height - 0.01) / 2), position[2] + side * 0.45], [0.14, Math.max(0.01, height - 0.12), 0.14], 0x82694c);
        this.box(fixed, [position[0], top - 0.06, position[2]], [0.18, 0.12, 1.1], 0x82694c); break;
      case 'twinrail':
        this.box(fixed, [position[0], y, position[2] - 0.6], [0.09, height, 0.09], 0xb5925a);
        this.box(fixed, [position[0], top + 0.025, position[2] - 0.2], [0.12, 0.1, 0.9], 0xb5925a); break;
      case 'girder':
        if (frame || !station.span || isVillageTrack(station.mechanism)) {
          for (const side of [-1, 1]) this.box(fixed,
            [position[0], y - Math.min(0.06, (height - 0.01) / 2), position[2] + side * 0.3],
            [0.12, Math.max(0.01, height - 0.12), 0.12], 0x657578);
          this.box(fixed, [position[0], top - 0.06, position[2]], [0.18, 0.12, 0.84], 0x657578);
          break;
        }
        const diagonalBank=this.route.mode==='cinematic'&&'travel'in station.mechanism&&typeof station.mechanism.travel!=='number'&&Math.hypot(station.mechanism.travel[0],station.mechanism.travel[2])>8;
        if(diagonalBank&&'travel'in station.mechanism&&typeof station.mechanism.travel!=='number'){
          // Put cable-bank pylons beside the diagonal swept corridor, rather
          // than directly behind its starting deck in the global z direction.
          const travel=station.mechanism.travel,yaw=Math.atan2(-travel[2],travel[0]),pylon=new THREE.Group();pylon.name=`village-bank-pylon-${station.stop}`;
          pylon.matrixAutoUpdate=false;pylon.matrix.makeTranslation(position[0],0,position[2]).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeTranslation(-position[0],0,-position[2]));pylon.matrixWorldNeedsUpdate=true;fixed.add(pylon);fixed=pylon;
        }
        for (const side of [-1, 1]) {
          if(this.route.mode==='cinematic'&&side===1)continue;
          this.box(fixed, [position[0], y + 1, position[2] + side * (diagonalBank?2.4:1.2)], [0.12, height + 2, 0.12], 0x657578);
          if(!diagonalBank)this.box(fixed, [position[0], top + 1, position[2] + side * 0.5], [0.055, 2, 0.055], 0x657578);
        }
        this.box(fixed, [position[0], top + 2, position[2]-(diagonalBank?1.2:0)], [0.15, 0.12, 2.55], 0x657578);
        if(diagonalBank){
          // Hang the FIXED rail from above. A crosshead at deck height caught
          // the moving shoe as it reached the far bank.
          const from=new THREE.Vector3(position[0],top+1.95,position[2]-.4),to=new THREE.Vector3(position[0],top+.01,position[2]-.65).applyMatrix4(fixed.matrix.clone().invert()),direction=to.clone().sub(from),centre=from.clone().add(to).multiplyScalar(.5);
          this.mesh(fixed,new THREE.BoxGeometry(.055,direction.length(),.055).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize())).translate(...centre.toArray()),0x657578);
        }else this.box(fixed, [position[0], top - 0.1, position[2]], [0.2, 0.2, 1.1], 0x657578); break;
      case 'steel': {
        for (const side of [-1, 1]) this.box(fixed, [position[0], y - Math.min(0.04, (height - 0.01) / 2), position[2] + side * 0.4], [0.08, Math.max(0.01, height - 0.08), 0.08], 0x657578);
        if (height > 0.2) {
          const diagonal = new THREE.BoxGeometry(0.06, Math.hypot(height - 0.12, 0.8), 0.06);
          diagonal.rotateX(Math.atan2(0.8, height - 0.12)).translate(position[0], y, position[2]); this.mesh(fixed, diagonal, 0x657578);
        }
        this.box(fixed, [position[0], top - 0.04, position[2]], [0.12, 0.08, 0.95], 0x657578); break;
      }
    }
    if (frame && !path) {
      if (frame.normal[1] <= 0.05) throw new Error('Inverted track needs authored side or bank supports');
      const yaw = Math.atan2(-frame.tangent[2], frame.tangent[0]);
      const normal = new THREE.Vector3(...frame.normal).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
      fixed.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const vertices = object.geometry.getAttribute('position');
        for (let i = 0; i < vertices.count; i++) {
          const x = vertices.getX(i), z = vertices.getZ(i), originalY = vertices.getY(i);
          const slope = -(normal.x * (x - position[0]) + normal.z * (z - position[2])) / normal.y;
          const heightFraction = Math.max(0, Math.min(1, (originalY - ground) / height));
          vertices.setY(i, originalY + slope * heightFraction);
        }
        object.geometry.computeVertexNormals();
        object.geometry.computeBoundingBox();
        object.geometry.computeBoundingSphere();
      });
    }
    if(this.staticConstruction){if(!ownership||!post)throw Error('Missing actual plank provider');this.staticConstruction.post(ownership,post,capMesh);}
    return post;
  }
  private driveDistance(station: VillageStation): number {
    if(this.route instanceof VillageCinematic)return this.route.weightStroke(station.stop);
    if (station.retention) return station.retention.weightDrop;
    const m = station.mechanism;
    return m.kind === 'wheelbucket' ? Math.abs(m.angle * m.radius) * 0.4
      : 'travel' in m && typeof m.travel !== 'number' ? Math.hypot(...m.travel) * 0.5 : 0;
  }
  /** Fixed upper dock reaches two real bank trestles behind the wheel. Its
   * horizontal beam is one mitered solid, so elbows have no overlapping caps. */
  private buildWheelDock(station:VillageStation,points:readonly VillagePort[]):void {
    if(!station.supports||station.supports.length!==2)throw new Error('Wheel dock requires two bank mounts');
    const fixed=this.staticSolids[station.stop]!,frame=points[Math.round((points.length-1)*.8)]!;
    const underside=new THREE.Vector3(...frame.position).addScaledVector(new THREE.Vector3(...frame.normal),-.3-villageFloorDepth(this.plan.profile));
    const cap=villageBearingCap(points,this.plan.profile,frame,underside.toArray(),.06,.08);
    this.mesh(fixed,cap,0x657578).name=`village-dock-${station.stop}-cap`;
    const top=cap.boundingBox!.min.y,thickness=.1;
    const banks=[...station.supports].sort((a,b)=>Math.hypot(b[0]-underside.x,b[2]-underside.z)-Math.hypot(a[0]-underside.x,a[2]-underside.z));
    const far=banks[0]!,near=banks[1]!;
    for(const [index,bank] of banks.entries()){
      const height=top-thickness-bank[1];
      if(height<=0)throw new Error('Upper dock bank mount is above its girder');
      this.mesh(fixed,new THREE.BoxGeometry(.1,height,.1).translate(bank[0],bank[1]+height/2,bank[2]),0x657578).name=`village-dock-${station.stop}-mast-${index}`;
    }
    const path=[new THREE.Vector2(far[0],far[2]),new THREE.Vector2(near[0],near[2]),new THREE.Vector2(underside.x,near[2]),new THREE.Vector2(underside.x,underside.z)];
    const directions=path.slice(1).map((point,i)=>point.clone().sub(path[i]!).normalize());
    const sides=path.map((_,i)=>{
      const a=directions[Math.max(0,i-1)]!,b=directions[Math.min(i,directions.length-1)]!;
      const n=new THREE.Vector2(-a.y,a.x).add(new THREE.Vector2(-b.y,b.x)).normalize();
      const denominator=n.dot(new THREE.Vector2(-a.y,a.x));
      if(denominator<.2)throw new Error('Wheel dock beam has an unsupported folded joint');
      return n.multiplyScalar(.05/denominator);
    });
    const outline=[...path.map((point,i)=>point.clone().add(sides[i]!)),...path.map((point,i)=>point.clone().sub(sides[i]!)).reverse()];
    const shape=new THREE.Shape(outline),beam=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});
    beam.rotateX(Math.PI/2).translate(0,top,0);
    this.mesh(fixed,beam,0x657578).name=`village-dock-${station.stop}-girder`;
  }
  private buildTerminal(station:VillageStation):void {
    const path=new VillageTerminalPath(station),fixed=this.staticSolids[station.stop]!,head=new THREE.Group();
    head.name=`village-${station.stop}-damper`;this.groups[station.stop]!.add(head);
    this.mesh(head,new THREE.CylinderGeometry(.04,.04,.44,16).rotateX(Math.PI/2),0x657578);
    const returnOutline=new THREE.Shape([
      new THREE.Vector2(.22,-.04),new THREE.Vector2(.26,-.04),
      new THREE.Vector2(.26,.18),new THREE.Vector2(.63,.18),
      new THREE.Vector2(.63,-.48),new THREE.Vector2(.67,-.48),
      new THREE.Vector2(.67,.22),new THREE.Vector2(.22,.22),
    ]);
    const returnBracket=new THREE.ExtrudeGeometry(returnOutline,{depth:.04,bevelEnabled:false,steps:1});
    returnBracket.rotateY(-Math.PI/2).translate(.02,0,0);
    this.mesh(head,returnBracket,0x657578);
    const matrix=new THREE.Matrix4();path.headPose(path.startDistance,matrix);
    const planar=!!this.route.terminalPad(station.stop);
    if(planar){const parts=terminalGuideParts(matrix,station.terminalCapture!.availableStroke);
      this.mesh(head,parts.collar,0xb5925a).name=`village-terminal-collar-${station.stop}`;
      this.mesh(fixed,parts.rod,0x657578).name=`village-terminal-guide-${station.stop}`;
    }else{
      this.box(head,[0,-.485,.65],[.10,.01,.24],0xb5925a);
      for(const side of [-1,1])this.box(head,[0,-.555,.65+side*.11],[.10,.13,.02],0xb5925a);
    }
    matrix.decompose(head.position,head.quaternion,head.scale);
    this.movers.push({group:head,station,auxiliary:'damper'});
    const previous=new THREE.Vector3(),point=new THREE.Vector3();
    const steps=planar?1:Math.ceil(station.terminalCapture!.availableStroke/.04);
    for(let i=0;i<=steps;i++) {
      path.headPose(path.startDistance+station.terminalCapture!.availableStroke*i/steps,matrix);
      point.set(0,-.55,.65).applyMatrix4(matrix);
      if(planar)point.addScaledVector(new THREE.Vector3().setFromMatrixColumn(matrix,0),i?TERMINAL_GUIDE_MARGIN:-TERMINAL_GUIDE_MARGIN);
      if(i&&!planar) {
        const delta=point.clone().sub(previous),length=delta.length();
        const rod=new THREE.CylinderGeometry(.035,.035,length,6)
          .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
        const center=point.clone().add(previous).multiplyScalar(.5);rod.translate(center.x,center.y,center.z);this.mesh(fixed,rod,0x657578);
      }
      if(i===0||i===steps) {
        const centre=new THREE.Vector3(),tangent=new THREE.Vector3(),normal=new THREE.Vector3();
        path.at(path.startDistance+station.terminalCapture!.availableStroke*i/steps,centre,tangent,normal);
        const frame=villagePort(centre.toArray(),tangent.toArray(),normal.toArray(),station.entry.width);
        const underside=centre.clone().addScaledVector(normal,-.3-villageFloorDepth(this.plan.profile));
        const cap=villageBearingCap(path.points,this.plan.profile,frame,underside.toArray(),.06,.08);
        this.mesh(fixed,cap,0x657578);
        const mount=new THREE.Vector3(underside.x,cap.boundingBox!.min.y,underside.z);
        const lower=point.clone().addScaledVector(normal,-.22);
        for(const [a,b] of [[mount,lower],[lower,point]]){
          const delta=b!.clone().sub(a!),length=delta.length(),center=b!.clone().add(a!).multiplyScalar(.5);
          this.mesh(fixed,new THREE.CylinderGeometry(.025,.025,length,6)
            .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()))
            .translate(center.x,center.y,center.z),0x657578);
        }
      }
      previous.copy(point);
    }
  }
  private readonly axleLand?:AxleLand;
  private readonly axleDraw=new Map<number,AxleDrawBinding>();
  private readonly axleNeighbours=new Map<number,THREE.Mesh>();
  private readonly axleSplices=new Map<VillageConnector,{source:THREE.Mesh;dock:'home'|'top'}>();
  private readonly axleTrackRanges=new Map<THREE.Mesh,{mesh:THREE.Mesh;home:THREE.Group;first:number;count:number;position:Float32Array;normal:Float32Array;color:Float32Array;geometry:THREE.BufferGeometry;attributes:readonly THREE.BufferAttribute[];arrays:readonly object[];versions:readonly number[];counts:readonly number[];operator:THREE.Matrix4}>();
  private axleFixedSource?:{mesh:THREE.Mesh;binding:AxleDrawBinding};
  axleMover(id:string){for(const binding of this.axleDraw.values())for(const mover of binding.physicalMovers)if(mover.id===id)return mover;return undefined;}
  axleInspection(stop:number){const b=this.axleDraw.get(stop);if(!b)throw new Error('No actual axle binding');return b;}
  private axleSplice(link:VillageConnector,station:VillageStation){
    if(this.plan.profile!=='timber'||this.staticConstruction)throw new Error('Selected axle splice requires the unchanged timber emitter');
    const binding=this.axleInspection(station.stop),motion=this.route.axleMotion(station.stop)!,deck=binding.parts.find(p=>p.id==='deck-channel');
    if(!deck||deck.body!=='carrier'||deck.frame!=='carrier-local')throw new Error('Actual owned deck source required');
    // Verify the canonical floor against its literal two-ring emitter before deriving the source ring.
    const expected=villageChannelGeometry([villagePort([-.8,0,0]),villagePort([.8,0,0])],'timber');
    try{for(const name of['position','normal']){const a=deck.render.getAttribute(name),b=expected.getAttribute(name);if(a.itemSize!==b.itemSize||a.count!==b.count||Array.from(a.array).some((v,i)=>!Object.is(v,b.array[i])))throw new Error('Changed actual deck emitter '+name);}if(Array.from(deck.render.index!.array).some((v,i)=>v!==expected.index!.array[i]))throw new Error('Changed actual deck index');}finally{expected.dispose();}
    const dock=link.to===station.stop?'home':'top',neighbour=this.axleNeighbours.get(dock==='home'?station.stop+1:station.stop-1);if(!neighbour)throw new Error('Actual selected static track neighbour missing');
    const matrix=new THREE.Matrix4();motion.carrierPose(dock==='home'?motion.approach.start:motion.end,matrix);
    motion.work.phase='native-splice-source';motion.work.tick(160);return axleSpliceGeometry(link.points,{tick:n=>motion.work.tick(n),dock,deckLocal:deck.render.getAttribute('position')as THREE.BufferAttribute,deckEndRing:[0,1,2,3,4,5,6,7],matrix,neighbour,home:this.staticSolids[link.from]!,neighbourEnd:dock==='home'?'last':'first'});
  }
  private axleNativeValidation?:Map<THREE.Mesh,{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;first:number;count:number;toWorld:THREE.Matrix4}>;
  /** Invocation-local, actual RANGE keys. Every distinct source/slice/frame is
   * deeply checked once in this synchronous gate; independent reads stay deep. */
  withAxleNativeValidation<V>(run:()=>V):V{if(this.axleNativeValidation)throw Error('Nested native axle validation');this.axleNativeValidation=new Map();try{return run();}finally{this.axleNativeValidation=undefined;}}
  axleSpliceInspection(link:VillageConnector,tick?:(n?:number)=>void){
    const actual=this.axleSplices.get(link);if(!actual||!axleSpliceSource(actual.source.geometry,tick))throw new Error('Changed/unowned selected splice source');
    const native=(source:THREE.Mesh)=>{const checked=this.axleNativeValidation?.get(source);if(checked){tick?.(1);return checked;}const range=this.axleTrackRanges.get(source);if(!range||range.mesh.parent!==range.home||range.mesh.geometry.index||range.mesh.matrixWorldNeedsUpdate)throw new Error('Changed/unbound actual axle track range');
      for(let owner:THREE.Object3D|null=range.mesh;owner;owner=owner.parent){if(!owner.visible||owner.matrixWorldNeedsUpdate)throw new Error('Hidden/dirty actual axle track ancestor');const local=owner.matrixAutoUpdate?new THREE.Matrix4().compose(owner.position,owner.quaternion,owner.scale):owner.matrix;if(local.elements.some((v,i)=>!Object.is(v,owner.matrix.elements[i])))throw new Error('Stale actual axle track manual/parent matrix');}
      const identity=new THREE.Matrix4();if(range.mesh.matrixWorld.elements.some((v,i)=>v!==identity.elements[i]))throw new Error('Selected track requires its actual fixed world frame');
      const p=range.mesh.geometry.getAttribute('position'),n=range.mesh.geometry.getAttribute('normal'),c=range.mesh.geometry.getAttribute('color');
      tick?.(3*range.count*3+range.count*3);if(range.mesh.geometry!==range.geometry||Object.keys(range.geometry.attributes).sort().join(',')!=='color,normal,position'||range.geometry.drawRange.start!==0||range.geometry.drawRange.count!==Infinity||!p||!n||!c||[p,n,c].some((a,i)=>a!==range.attributes[i]||a.array!==range.arrays[i]||a.version!==range.versions[i]||a.count!==range.counts[i])||[p,n,c].some(a=>a.itemSize!==3||a.normalized||range.first+range.count>a.count))throw new Error('Changed native axle track shape');
      for(const[a,b]of[[p,range.position],[n,range.normal],[c,range.color]]as const)for(let i=0;i<b.length;i++)if(!Object.is(a.array[range.first*3+i],b[i]))throw new Error('Changed actual native axle track stores');
      const expanded=source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone();try{expanded.applyMatrix4(range.operator);for(const name of['position','normal','color']){const a=expanded.getAttribute(name),b=range.mesh.geometry.getAttribute(name);if(a.itemSize!==3||a.count!==range.count)throw new Error('Changed actual track source shape');for(let i=0;i<a.array.length;i++)if(!Object.is(a.array[i],b.array[range.first*3+i]))throw new Error('Changed actual track source/bake');}}finally{expanded.dispose();}
      const result={mesh:range.mesh,geometry:range.mesh.geometry,first:range.first,count:range.count,toWorld:range.mesh.matrixWorld.clone()};this.axleNativeValidation?.set(source,result);return result;};
    const neighbour=this.axleNeighbours.get(actual.dock==='home'?link.from:link.to);if(!neighbour)throw new Error('Missing actual static neighbour');
    return{...actual,native:native(actual.source),neighbour:{source:neighbour,native:native(neighbour)}};
  }
  private build(station: VillageStation): void {
    if(station.mechanism.kind==='wheelbucket'&&station.mechanism.axleCarry){const motion=this.route.axleMotion(station.stop);if(!motion)throw new Error('Actual upstream prefix has not reached axle; never synthesize arrival');const connector=this.plan.connectors.find(l=>l.from===station.stop)!,next=this.plan.stations.find(s=>s.stop===station.stop-1)!,tracks=[connector.points,'points'in next.mechanism?next.mechanism.points:[]]as const,built=(()=>{motion.work.phase='native-spoke-construction';return axleParts(station as AxleStation,this.axleLand,tracks,motion.camTemplate,(n=1)=>motion.work.tick(n),motion.journalConstruction);})(),binding=new AxleDrawBinding(station as AxleStation,built.parts,built.line,this.material,motion);this.axleDraw.set(station.stop,binding);this.groups[station.stop]!.add(binding.carrier,binding.rotor,binding.weight);const fixed=new THREE.Mesh(binding.fixed,this.material);this.axleFixedSource={mesh:fixed,binding};this.staticSolids[station.stop]!.add(fixed);return;}

    const fixed = this.staticSolids[station.stop]!, mechanism = station.mechanism;
    const captiveCarrierParts=station.retention?.opening==='captive-leaf'?new Map<CarrierWeldId,CarrierWeldPart>():undefined;
    const remember=(id:CarrierWeldId,parent:THREE.Group,closed?:THREE.BufferGeometry)=>{if(!captiveCarrierParts)return;const mesh=parent.children.at(-1);if(!(mesh instanceof THREE.Mesh))throw new Error('Actual carrier builder did not return a mesh');captiveCarrierParts.set(id,{mesh,closed:closed??mesh.geometry});};

    if (station.channelLip && !isVillageTrack(mechanism)) throw new Error('Channel lip metadata cannot be attached to a moving floor');
    if (station.span && (!station.supports || station.supports.length < 2)) throw new Error('Structural station span requires two authored bank supports');
    if (station.supports) station.supports.forEach((mount,index)=>this.support(station,mount,true,undefined,undefined,this.plan.profile,station.terrainFeet?.includes(index)?{id:`station-${station.stop}-${index}`}:undefined,this.staticConstruction?{kind:'explicit',owner:{kind:'station',station},index}:undefined));
    if(station.terminalCapture)this.buildTerminal(station);
    if (isVillageTrack(mechanism)) {
      if (station.releasePin) {
        const pin = new THREE.Group(); pin.name = `village-${station.stop}-pin`;
        const tangent = new THREE.Vector3(...station.entry.tangent), normal = new THREE.Vector3(...station.entry.normal);
        const matrix = new THREE.Matrix4().makeBasis(tangent, normal, new THREE.Vector3().crossVectors(tangent, normal));
        matrix.setPosition(...station.entry.position); matrix.decompose(pin.position, pin.quaternion, pin.scale);
        this.groups[station.stop]!.add(pin); this.movers.push({ group: pin, station, auxiliary: 'gate' });
        this.box(pin, [.34, .15, 0], [.08, .5, .12], 0xb5925a);
      }
      if (station.span) this.mesh(fixed, villageSpanGeometry(mechanism.points, this.plan.profile), 0x657578).name = `village-span-${station.stop}`;
      const trackMesh=this.mesh(fixed, villageChannelGeometry(mechanism.points, mechanism.kind === 'loop' ? 'twinrail' : this.plan.profile,undefined,mechanism.kind==='bowl'&&this.plan.profile==='terracotta'&&!!station.terminalCapture&&!!new VillageTerminalPath(station).pad,station.channelLip?{lip:station.channelLip,staticFloor:true,protectedOriginalFrames:station.terminalCapture?[mechanism.points.length-2,mechanism.points.length-1]:[]}:undefined,this.staticConstruction!==undefined), station.color);trackMesh.name=`village-track-${mechanism.kind}-${station.stop}`;this.staticConstruction?.track({kind:'station',station},trackMesh);if(this.plan.stations.some(s=>s.mechanism.kind==='wheelbucket'&&s.mechanism.axleCarry&&station.stop===s.stop-1))this.axleNeighbours.set(station.stop,trackMesh);
      const supportFrames=station.supportIndices?.map(i=>mechanism.points[i]!)??(mechanism.kind==='loop'?[.03,.97]:mechanism.kind==='bowl'?[.35,.65]:[.15,.85])
        .map(fraction=>mechanism.points[Math.round(fraction*(mechanism.points.length-1))]!);
      for(const frame of supportFrames)this.support(station,frame.position,false,frame,mechanism.points,mechanism.kind==='loop'?'twinrail':this.plan.profile,undefined,this.staticConstruction?{kind:'frame',owner:{kind:'station',station},index:mechanism.points.indexOf(frame)}:undefined);
      return;
    }
    const group = new THREE.Group(); group.name = `village-${station.stop}-carrier`; group.matrixAutoUpdate = false;
    const moving = hasVillageCarrier(mechanism);
    if (moving) { this.groups[station.stop]!.add(group); this.movers.push({ group, station }); }
    else {
      mechanismMatrix(mechanism, station.anchor, 0, group.matrix);
      group.matrixWorldNeedsUpdate = true; fixed.add(group);
    }
    if (station.retention || mechanism.kind === 'wheelbucket' || mechanism.kind === 'translating' || mechanism.kind === 'suspended') {
      const cinematic=this.route.mode==='cinematic';
      const source:CinematicSource = cinematic?cinematicSource(station,this.driveDistance(station),this.groundHeightAt,VILLAGE_SHAPES[this.plan.chapter]?.[station.stop]?.sourceX):sourceMountLayout(station, this.driveDistance(station), this.groundHeightAt);
      const weight = new THREE.Group(); weight.name = `village-${station.stop}-weight`;
      weight.position.set(...source.weight);
      this.groups[station.stop]!.add(weight); this.movers.push({ group: weight, station, auxiliary: 'weight' });
      if (station.retention||cinematic) this.mesh(weight, counterweightGeometry(), 0x596f70);
      else this.box(weight, [0, 0, 0], [0.38, 0.5, 0.38], 0x596f70);
      if (source.guide.kind === 'hung') {
        const guide=new THREE.BoxGeometry(...source.guide.size).translate(...source.guide.centre);
        // Its top cap is inside the pulley beam; the beam owns that shared surface.
        if(cinematic&&source.post)guide.setIndex(Array.from(guide.index!.array).filter((_,i)=>i<12||i>=18));
        this.mesh(fixed,guide,0x65543f);
      }
      else this.mesh(fixed, groundedGuideGeometry(source.guide,cinematic?this.groundHeightAt:undefined), 0x65543f);
      if(source.post){const post=new THREE.BoxGeometry(...source.post.size).translate(...source.post.centre),p=post.getAttribute('position');for(let i=0;i<p.count;i++)if(p.getY(i)<source.post.centre[1]){const ground=this.groundHeightAt(p.getX(i),p.getZ(i));if(ground===undefined)throw Error('Source mast footprint crosses a void');p.setY(i,ground);}post.setIndex(Array.from(post.index!.array).filter((_,i)=>i<12||i>=24));post.computeVertexNormals();this.mesh(fixed,post,0x657578).name=`village-source-mast-${station.stop}`;}
      // Keep the pulley beam in front of the upright collar's complete travel.
      // Its cable/guide at z=-.96 remains inside the beam, with .02 separation
      // from the collar's nearest outer face at z=-1.07.
      this.box(fixed, source.beam.centre, source.beam.size, 0x82694c);
    }
    if (station.retention) {
      const fork = new THREE.Group(); fork.name = `village-${station.stop}-fork`;
      this.groups[station.stop]!.add(fork); this.movers.push({ group: fork, station, auxiliary: 'fork', carrierLocal: true });
      const direction = mechanism.kind === 'wheelbucket' && mechanism.angle < 0 ? -1 : 1;
      const side = this.route.retainedSide(station.stop);
      const keyedHead=this.route.retainedHeadRole(station.stop)!==undefined;
      const retainedLayout=this.route.retainedLayout(station.stop);
      let frame:THREE.Group|undefined;
      if(retainedLayout==='keyed-prismatic'){frame=new THREE.Group();frame.name=`village-${station.stop}-head-frame`;this.groups[station.stop]!.add(frame);this.movers.push({group:frame,station,auxiliary:'head-frame',carrierLocal:true});}
      let head:THREE.Group|undefined;
      if(keyedHead){head=new THREE.Group();head.name=`village-${station.stop}-capture-head`;this.groups[station.stop]!.add(head);this.movers.push({group:head,station,auxiliary:'capture-head',carrierLocal:true});}
      const parts=retainerParts(this.plan.profile,retainedLayout,direction,side),actual=new Map<string,THREE.Mesh>();
      for(const part of parts){const mesh=this.mesh(part.group==='frame'?frame!:part.group==='head'?head!:fork,part.geometry,part.color);mesh.userData.retainerPart=Object.freeze({id:part.id,body:part.body});actual.set(part.id,mesh);}
      if(retainedLayout==='keyed-prismatic'){
        for(const part of parts){const geometry=captiveRenderGeometry(part,parts),mesh=actual.get(part.id)!;if(geometry!==mesh.geometry){this.geometries.add(geometry);mesh.geometry=geometry;}}
        const arm=actual.get('lift-arm')!;
        try{const result=trimEnclosedCaps(arm,actual);this.geometries.add(result.geometry);arm.geometry=result.geometry;arm.userData.captiveEnclosedCaps={status:'certified',reports:result.reports};}
        catch(error){arm.userData.captiveEnclosedCaps={status:'kept-full-caps',failure:error instanceof Error?error.message:String(error)};}
        // A failed E1/E2 proof keeps the original geometry and its REAL census.
      }
      const first = station.retention.captureStart + direction * .34, last = this.route.retainedForkOrigin(station.stop);
      const low = Math.min(first, last), high = Math.max(first, last);
      // A real L-slot carries the fork axle through its brake and lift strokes.
      if(keyedHead&&['terracotta','plank','timber'].includes(this.plan.profile)&&direction===1&&side===-1){this.mesh(group,openGuideGeometry(first,last),0x657578).name=`village-open-guide-${station.stop}`;remember('open-guide',group);}
      else this.box(group, [(low + high) / 2, -.045, side * .9], [high - low + .09, .02, .04], 0x657578);
      if(retainedLayout==='keyed-prismatic'){
        const corner=captiveSlotCornerGeometry(first,last),cover=openGuideGeometry(first,last);
        try{this.mesh(group,trimCoveredPlanes(corner,cover,{kind:'coplanar',coveredBy:'open-guide',normal:[0,1,0],plane:-.035}),0x657578).name=`village-slot-corner-${station.stop}`;remember('corner',group,corner);}finally{cover.dispose();if(captiveCarrierParts)this.geometries.add(corner);else corner.dispose();}
      }else{
        if (high - low > .09) this.box(group, [(low + high - .045) / 2, .045, side * .9], [high - low - .045, .02, .04], 0x657578);
        this.mesh(group, slotLegGeometry(last, side), 0x657578);
      }
      const bracketDepth = Math.max(.42, VILLAGE_RADIUS + villageFloorDepth(this.plan.profile) + .02);
      const bracketTop = -bracketDepth + .02, guideBottom = -.055;
      this.box(group, [last + .045, (guideBottom + bracketTop) / 2, side * .9], [.04, guideBottom - bracketTop, .04], 0x657578);remember('bracket',group);
      this.mesh(group,new THREE.BoxGeometry(.04,.04,.9).translate(last+.045,-bracketDepth,side*.45),0x657578).name=`village-${station.stop}-fork-bearing`;remember('bearing',group);
    }
    const contact = carrierContact(mechanism);
    const points = [-0.8, mechanism.kind === 'receiver' ? 1.15 : 0.8].map(x => villagePort([contact[0] + x, contact[1], contact[2]]));
    const travel = dockingTravel(station);
    const localTravel = travel ? new THREE.Vector3(...travel).transformDirection(mechanismMatrix(mechanism, station.anchor, 1, new THREE.Matrix4()).invert()).toArray() as VillageVec3 : undefined;
    const carrierFloor=this.mesh(group,villageChannelGeometry(points,this.plan.profile,{start:localTravel,end:localTravel},false,undefined,!!this.staticConstruction&&!moving&&(station.stop===0||station.stop===1)),station.color);carrierFloor.name=`village-track-carrier-${station.stop}`;remember('deck',group);if(!moving&&this.plan.stations.some(s=>s.mechanism.kind==='wheelbucket'&&s.mechanism.axleCarry&&station.stop===s.stop+1))this.axleNeighbours.set(station.stop,carrierFloor);
    if(this.staticConstruction&&!moving&&(station.stop===0||station.stop===1))this.staticConstruction.fixedFloor(station,carrierFloor);
    if (mechanism.kind === 'receiver') {
      const wall = new THREE.BoxGeometry(0.1, 0.64, 1.04), vertices = wall.getAttribute('position');
      for (let i = 0; i < vertices.count; i++) vertices.setXYZ(i,
        contact[0] + (vertices.getX(i) < 0 ? 1.15 : 1.25),
        vertices.getY(i) + contact[1] - 0.12, vertices.getZ(i) + contact[2]);
      this.mesh(group, wall, station.color);
    }
    if ('pivot' in mechanism) {
      const p = mechanism.pivot;
      const carrierDepth = this.plan.profile === 'twinrail'
        ? Math.sqrt((VILLAGE_RADIUS + 0.055) ** 2 - 0.22 ** 2) + 0.055
        : VILLAGE_RADIUS + villageFloorDepth(this.plan.profile);
      if(station.rollingDrive?.kind==='contact-gravity-rocker'){
        if(this.plan.profile!=='terracotta'||station.hinge!=='outboard-journal')throw new Error('Rocker renderer requires certified planar floor/journal opt-in');
        const kit=gravityHingeParts(station,station.rollingDrive,this.groundHeightAt),parts:(NativeHingePart&{sourceMesh:THREE.Mesh})[]=[];
        for(const part of kit.parts){const owner=part.body==='carrier'?group:fixed;if(part.body==='fixed')part.geometry.translate(...station.anchor);const mesh=this.mesh(owner,part.geometry,part.color);mesh.userData.gravityHingePart={id:part.id,body:part.body};parts.push({id:part.id,body:part.body,geometry:mesh.geometry,sourceMesh:mesh,toStation:part.body==='carrier'?new THREE.Matrix4():new THREE.Matrix4().makeTranslation(-station.anchor[0],-station.anchor[1],-station.anchor[2]),owner});}
        this.rockerBindings.set(station.stop,{parts,carrier:group,fixed});
      }else{
      this.box(group, [contact[0], contact[1] - carrierDepth - 0.06, contact[2]], [1.6, 0.12, 0.55], 0x9d784f);
      this.mesh(fixed, new THREE.CylinderGeometry(0.09, 0.09, this.plan.profile === 'girder' && Math.abs(mechanism.axis[1]) > .99 ? .68 : .7, 10)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...mechanism.axis)))
        .translate(station.anchor[0] + p[0], station.anchor[1] + p[1], station.anchor[2] + p[2]), 0x657578);
      this.support(station,[station.anchor[0]+p[0],station.anchor[1]+p[1]+0.2,station.anchor[2]+p[2]],false,undefined,undefined,this.plan.profile,undefined,this.staticConstruction?{kind:'anchor',station,site:'pivot'}:undefined);
      }
      if (mechanism.kind === 'launcher') this.box(group, [p[0] - 0.7, p[1] - 0.8, p[2]], [0.5, 0.5, 0.5], 0x596f70);
      if (station.retention) {
        if (mechanism.dockingLift) {
          const spindle = new THREE.CylinderGeometry(.065, .065, mechanism.dockingLift + .3, 8)
            .translate(p[0], p[1] - (mechanism.dockingLift + .3) / 2, p[2])
            .rotateZ(-(mechanism.deckPitch ?? 0));
          this.mesh(group, spindle, 0xb5925a);
        }
        const low = station.anchor[1] + p[1], high = station.anchor[1] + 2.25;
        this.box(fixed, [station.anchor[0] + p[0], (low + high) / 2, station.anchor[2] - 1.05], [.04, high - low, .04], 0xb5925a);
        this.box(fixed, [station.anchor[0] + p[0], low, station.anchor[2] - .525], [.05, .05, 1.05], 0xb5925a);
      }
    } else if (mechanism.kind === 'wheelbucket') {
      // The bucket's rear axle occupies the wheel plane; its deck remains upright.
      const deckDepth = this.plan.profile === 'twinrail'
        ? Math.sqrt((VILLAGE_RADIUS + 0.055) ** 2 - 0.22 ** 2) + 0.055
        : VILLAGE_RADIUS + villageFloorDepth(this.plan.profile);
      const axleY = -deckDepth - 0.1;
      const pitch = mechanism.deckPitch ?? 0;
      this.box(group, [0, -deckDepth - 0.04, 0], [0.14, 0.08, 0.55], 0x657578);
      this.mesh(group, new THREE.CylinderGeometry(0.07, 0.07, 0.65, 10).rotateX(Math.PI / 2)
        .translate(axleY * Math.sin(pitch), axleY * Math.cos(pitch), -0.325), 0x657578);
      const wheel = new THREE.Group(); wheel.name = `village-${station.stop}-wheel`;
      wheel.position.set(station.anchor[0], station.anchor[1] + mechanism.radius + axleY, station.anchor[2] - 0.65);
      this.groups[station.stop]!.add(wheel); this.movers.push({ group: wheel, station, auxiliary: 'wheel' });
      this.mesh(wheel, new THREE.TorusGeometry(mechanism.radius, 0.08, 5, 32), 0xb5925a);
      for (let i = 0; i < 3; i++) this.mesh(wheel, new THREE.BoxGeometry(0.07, mechanism.radius * 2, 0.06).rotateZ(i * Math.PI / 3).translate(0, 0, i * 0.012), 0xc7aa70);
      this.mesh(fixed, new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10).rotateX(Math.PI / 2)
        .translate(wheel.position.x, wheel.position.y, wheel.position.z - 0.25), 0x657578);
      this.support(station, [wheel.position.x, wheel.position.y - 0.09 + VILLAGE_RADIUS + villageFloorDepth(this.plan.profile), wheel.position.z - 0.5]);
    } else if ('travel' in mechanism && typeof mechanism.travel !== 'number') {
      // Rigid visible yoke and suspension travel with the same carrier matrix.
      const underside = this.plan.profile === 'twinrail'
        ? Math.sqrt((VILLAGE_RADIUS + 0.055) ** 2 - 0.22 ** 2) + 0.055
        : VILLAGE_RADIUS + villageFloorDepth(this.plan.profile);
      const yokeBottom = -underside - 0.08;
      const rimReturn=['terracotta','plank','timber'].includes(this.plan.profile)&&!!station.retention;
      // The rear portal carries the deck into its shoe/collar; leave the cargo-facing side open.
      const rearCantilever=rimReturn||this.route.mode==='cinematic';
      for (const side of [-1, 1]) {
        if(rearCantilever&&side===1)continue;
        if(rimReturn&&side===-1){
          const outline=new THREE.Shape([
            new THREE.Vector2(-.04,yokeBottom-.1),new THREE.Vector2(1.24,yokeBottom-.1),
            new THREE.Vector2(1.24,1.25),new THREE.Vector2(.04,1.65),new THREE.Vector2(-.04,1.65),
            new THREE.Vector2(-.04,1.57),new THREE.Vector2(.04,1.57),new THREE.Vector2(1.16,1.57-(1.16-.04)/3),
            new THREE.Vector2(1.16,yokeBottom-.02),new THREE.Vector2(.04,yokeBottom-.02),
            new THREE.Vector2(.04,yokeBottom+.08),new THREE.Vector2(-.04,yokeBottom+.08),
          ]);
          const depth=.08;
          const portal=new THREE.ExtrudeGeometry(new THREE.Shape(outline.getPoints().map(point=>new THREE.Vector2(-point.x,point.y))),{depth,bevelEnabled:false,steps:1});
          portal.translate(contact[0],contact[1],contact[2]-.6-depth);this.mesh(group,portal,0x657578).name=`village-rim-yoke-${station.stop}`;remember('yoke',group);
        }else this.box(group,[contact[0],contact[1]+(1.65+yokeBottom)/2,contact[2]+side*.64],[.08,1.65-yokeBottom,.08],0x657578);
      }
      this.box(group, [contact[0], contact[1] - underside - 0.04, contact[2]], [0.08, 0.08, 1.2], 0x657578);remember('deck-link',group);
      const verticalTravel = Math.hypot(mechanism.travel[0], mechanism.travel[2]) < 1e-6;
      const graded = 'deckPitch' in mechanism && !!mechanism.deckPitch;
      const inclined=graded||this.route.mode==='cinematic'&&!verticalTravel&&Math.abs(mechanism.travel[1])>1e-6;
      const carriageGuide = carriageGuideParts(station, this.plan.profile);
      if(carriageGuide?.kind==='post-collar'){
        // End at the collar's actual outer front face, rather than burying the
        // old beam cap inside its wall. This is the carriage-to-guide load path.
        const rear=contact[2]-1.2+.13,front=contact[2]+.75;
        this.box(group,[contact[0],contact[1]+1.7,(rear+front)/2],[.15,.1,front-rear],0x657578);
      }else this.box(group, [contact[0], contact[1] + 1.7, contact[2] - (verticalTravel ? rimReturn ? .17 : .02 : 0)],
        [0.15, 0.1, verticalTravel ? rimReturn ? 1.84 : 1.54 : 1.5], 0x657578);
      remember('beam',group);
      if (verticalTravel) {
        if (carriageGuide) {this.mesh(group, carriageGuide.caliper, 0x657578).name = `village-carriage-caliper-${station.stop}`;remember('caliper',group);}
        else {
        // A hollow guide collar slides around the rear post; its front wall
        // meets the yoke, while the moving metal stays outside the guide.
        for (const side of [-1, 1]) {
          this.box(group, [contact[0] + side * (graded ? .14 : .11), contact[1] + 1.7, contact[2] - (rimReturn ? 1.2 : .9)], [0.04, 0.18, 0.26], 0x657578);
          this.box(group, [contact[0], contact[1] + 1.7, contact[2] - (rimReturn ? 1.2 : .9) + side * 0.11], [graded ? .24 : .18, 0.18, 0.04], 0x657578);
        }
        }
      }
      const carrierFrame = mechanismMatrix(mechanism, station.anchor, 0, new THREE.Matrix4());
      const railLocal = new THREE.Vector3(contact[0], contact[1] + (inclined ? verticalTravel ? 1.7 : 1.97 : 1.81), contact[2] - (verticalTravel ? rimReturn ? 1.2 : .9 : .65));
      const railStart = railLocal.clone().applyMatrix4(carrierFrame);
      const railEnd = railStart.clone().add(new THREE.Vector3(...mechanism.travel));
      const direction = railEnd.clone().sub(railStart), length = direction.length();
      if (length > 0) {
        const geometry = carriageGuide?.rail ?? new THREE.BoxGeometry(length + (rimReturn&&!verticalTravel?1.4:.2), 0.12, 0.14);
        const railRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
        if (!carriageGuide?.rail) {
          geometry.applyQuaternion(railRotation);
          const centre = railStart.clone().add(railEnd).multiplyScalar(0.5); geometry.translate(centre.x, centre.y, centre.z);
        }
        if(rimReturn&&verticalTravel&&!carriageGuide?.rail)geometry.dispose();else {
          const rail=this.mesh(fixed, geometry, 0x657578);
          if(carriageGuide&&this.plan.profile!=='terracotta')rail.name=`village-carriage-rail-${station.stop}`;
        }
        if (inclined && !verticalTravel) {
          if (carriageGuide) {this.mesh(group, carriageGuide.caliper, 0x657578).name = `village-carriage-caliper-${station.stop}`;remember('caliper',group);}
          else {
          // The shoe's upper face is the actual rail underside plane; its lower
          // face sits on the pitched yoke. Both travel through the same frame.
          const up = new THREE.Vector3(0, 1, 0).applyQuaternion(railRotation).transformDirection(carrierFrame.clone().invert());
          if (up.y <= .5) throw new Error('Inclined suspension needs a collar rather than an underside shoe');
          const shoe = new THREE.BoxGeometry(.15, .1, .18), vertices = shoe.getAttribute('position');
          for (let i=0;i<vertices.count;i++) {
            const x=vertices.getX(i)+railLocal.x,z=vertices.getZ(i)+railLocal.z;
            const roof=railLocal.y+(-.06-up.x*(x-railLocal.x)-up.z*(z-railLocal.z))/up.y;
            if(roof <= contact[1]+1.75) throw new Error('Suspension shoe has no physical depth');
            vertices.setXYZ(i,x,vertices.getY(i)>0?roof:contact[1]+1.75,z);
          }
          shoe.computeVertexNormals();this.mesh(group,shoe,0x657578);
          }
        }
      }
      const verticalRail = Math.hypot(railStart.x - railEnd.x, railStart.z - railEnd.z) < 1e-6;
      const railFeet = verticalRail ? [railStart.y >= railEnd.y ? railStart : railEnd]
        : rimReturn?[railStart.clone().addScaledVector(direction,-.6),railEnd.clone().addScaledVector(direction,.6)]:[railStart,railEnd];
      const railNormal=this.plan.profile!=='terracotta'&&carriageGuide?carriageGuide.normal:new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),direction));
      if (!station.supports) for (const end of railFeet) {
        const footZ=end.z-(rimReturn&&!verticalRail?.6:0);
        const ground = this.groundHeightAt(end.x, footZ);
        if (ground === undefined || !Number.isFinite(ground)) throw new Error('Carrier rail requires authored bank supports over voids');
        // New finite post guides end above a separate ground post. Gardens retains its exact existing post mesh.
        const finitePost=verticalRail&&carriageGuide?.kind==='post-collar'&&!!carriageGuide.rail;
        const top=finitePost?Math.min(railStart.y,railEnd.y)-.09:rimReturn?(verticalRail?end.y+.1:end.y-.06/railNormal.y):end.y-.06;
        if (top <= ground) throw new Error('Carrier rail support is buried in terrain');
        const width=verticalRail?(rimReturn?.12:.16):.12,depth=verticalRail&&rimReturn?.14:width;
        const roof=(x:number,z:number)=>top-(rimReturn&&!verticalRail?(railNormal.x*(x-end.x)+railNormal.z*(z-end.z))/railNormal.y:0);
        const postTop=top-(rimReturn&&!verticalRail?.1:0);
        const postGeometry=new THREE.BoxGeometry(width,postTop-ground,depth).translate(end.x,(ground+postTop)/2,footZ);
        if(rimReturn){const vertices=postGeometry.getAttribute('position');for(let i=0;i<vertices.count;i++){
          const x=vertices.getX(i),z=vertices.getZ(i),bottom=this.groundHeightAt(x,z);
          if(bottom===undefined)throw new Error('Carrier post footprint crosses a void');
          vertices.setY(i,vertices.getY(i)<(ground+postTop)/2?bottom:roof(x,z)-(verticalRail?0:.1));
        }postGeometry.computeVertexNormals();}
        const joined=rimReturn&&!verticalRail?postBraceGeometry(end.x,end.z,footZ,width,roof,this.groundHeightAt):undefined;
        if(joined){postGeometry.dispose();this.mesh(fixed,joined,0x657578).name=`village-rim-post-${station.stop}`;}
        else{
        const post=this.mesh(fixed,postGeometry,0x657578);if(rimReturn)post.name=`village-rim-post-${station.stop}`;
        if(station.retention?.opening==='captive-leaf'&&this.plan.profile==='terracotta'&&carriageGuide?.kind==='post-collar'){
          const collar=group.children.find(o=>o instanceof THREE.Mesh&&o.geometry===carriageGuide.caliper);
          if(!(collar instanceof THREE.Mesh)||!this.movers.some(m=>m.group===collar.parent&&m.station===station&&!m.auxiliary))throw new Error('Actual compiled collar/carrier identity missing');
          if(this.route.hasCompiledRetained(station.stop))this.program!.certifyRetainedFixedPost(station.stop,post,collar,carrierFrame);
        }

        if(rimReturn&&!verticalRail){
          const brace=new THREE.BoxGeometry(width,.1,end.z-footZ+width).translate(end.x,top-.05,(footZ+end.z)/2),vertices=brace.getAttribute('position');
          for(let i=0;i<vertices.count;i++)vertices.setY(i,roof(vertices.getX(i),vertices.getZ(i))-(vertices.getY(i)<top-.05?.1:0));
          brace.computeVertexNormals();this.mesh(fixed,brace,0x657578).name=`village-rim-brace-${station.stop}`;
        }
        }
      }
      if(captiveCarrierParts&&this.route.hasCompiledRetained(station.stop)){if(!this.movers.some(m=>m.group===group&&m.station===station&&!m.auxiliary))throw new Error('Actual compiled carrier ownership missing');this.program!.certifyRetainedCarrierWelds(station.stop,captiveCarrierParts);}
    } else {
      if (mechanism.kind === 'escapement' && mechanism.pitch !== undefined) {
        this.support(station, station.anchor, false,
          villagePort(station.anchor,station.entry.tangent,station.entry.normal),[station.entry,station.exit],this.plan.profile,undefined,this.staticConstruction?{kind:'anchor',station}:undefined);
      }else this.support(station,station.anchor,false,undefined,undefined,this.plan.profile,undefined,this.staticConstruction?{kind:'anchor',station}:undefined);
      if(mechanism.kind==='striker'&&station.strikerDrive?.kind==='pendulum'){
        const d=station.strikerDrive,parts=pendulumParts(station,d,this.groundHeightAt),driven=new THREE.Group();
        driven.name=`village-${station.stop}-striker`;driven.position.set(...d.axle.origin);
        this.groups[station.stop]!.add(driven);this.movers.push({group:driven,station,auxiliary:'striker'});
        const frame=pendulumFrame(d);
        for(const part of parts.parts){
          const render=pendulumRenderGeometry(part,parts);
          const mesh=this.mesh(part.body==='hammer'?driven:fixed,part.body==='hammer'?render:render.applyMatrix4(frame),part.color);
          if(render!==part.geometry)part.geometry.dispose();
          mesh.name=`village-pendulum-${station.stop}-${part.id}`;mesh.userData.pendulumPart={id:part.id,body:part.body};
        }
        return;
      }
      if (mechanism.kind === 'escapement' || mechanism.kind === 'striker') {
        const driven = new THREE.Group(); driven.position.set(station.anchor[0] + (mechanism.kind === 'striker' ? 0.36 : 0.6), station.anchor[1], station.anchor[2]);
        driven.name = `village-${station.stop}-${mechanism.kind}`;
        this.groups[station.stop]!.add(driven);
        this.movers.push({ group: driven, station, auxiliary: mechanism.kind === 'escapement' ? 'gate' : 'striker' });
        if (mechanism.kind === 'striker') {
          this.box(driven, [0, 0.425, 0], [0.12, 0.85, 0.12], 0x657578);
          this.box(driven, [0.12, 0.95, 0], [0.36, 0.2, 0.3], station.color);
          if (station.strikerDrive&&station.strikerDrive.kind!=='pendulum') {
            const stroke = station.strikerDrive.stroke, angle = -1.4 * stroke;
            const x = station.anchor[0] + .36 + stroke + .12 * Math.cos(angle) - .95 * Math.sin(angle);
            const y = station.anchor[1] + .12 * Math.sin(angle) + .95 * Math.cos(angle);
            const z = station.anchor[2] - 2 * stroke - .19;
            this.box(fixed, [x, y, z], [.65, .45, .08], 0xb5925a);
            const ground = this.groundHeightAt(x, z);
            if (ground === undefined || ground >= y - .225) throw new Error('Striker anvil requires a real footing');
            this.box(fixed, [x, (ground + y - .225) / 2, z], [.08, y - .225 - ground, .08], 0x657578);
          }
        } else {
          const cinematic=this.route.mode==='cinematic';
          this.box(driven, [0, cinematic?.3675:.325, 0], [0.1, cinematic?.655:.57, 0.75], station.color);
          if(cinematic)this.mesh(driven,cinematicClockFollower(),0x657578);
          else this.box(driven, [-0.3, 0.65, -0.5], [0.7, 0.08, 0.08], 0x657578);
          const gear = new THREE.Group(); gear.name = `village-${station.stop}-gear`;
          gear.position.set(station.anchor[0] + (cinematic?.5:.7), station.anchor[1] + (cinematic?.875:.65), station.anchor[2] - (cinematic?.8:.65));
          this.groups[station.stop]!.add(gear); this.movers.push({ group: gear, station, auxiliary: 'gear' });
          const roller=cinematic?cinematicClockWheel():new THREE.CylinderGeometry(.18,.18,.12,12).rotateX(Math.PI/2);
          this.mesh(gear,roller,0xb5925a);
          const top = new THREE.Group(); top.name = `village-${station.stop}-top`;
          top.position.set(station.anchor[0] + 0.4, station.anchor[1], station.anchor[2] - (cinematic?.8:.65));
          this.groups[station.stop]!.add(top); this.movers.push({ group: top, station, auxiliary: 'top' });
          const topBody = this.mesh(top, new THREE.CylinderGeometry(0.3, 0.04, 0.5, 12).translate(0, -0.55, 0), station.color);
          const bodyVertices = topBody.geometry.getAttribute('position'), bodyColors = topBody.geometry.getAttribute('color');
          const stripe = new THREE.Color(0x405356);
          for (let i = 0; i < bodyVertices.count; i++) {
            const angle = Math.atan2(bodyVertices.getZ(i), bodyVertices.getX(i));
            if (Math.abs(angle) < Math.PI / 6 + 1e-6) bodyColors.setXYZ(i, stripe.r, stripe.g, stripe.b);
          }
          this.mesh(top, new THREE.CylinderGeometry(0.055, 0.055, 1.35, 10).translate(0, 0.05, 0), 0xb5925a);
          this.mesh(top, new THREE.CylinderGeometry(0.23, 0.23, 0.09, 12).translate(0, 0.65, 0), 0xb5925a);
          for (let tooth = 0; tooth < (cinematic?0:8); tooth++) {
            const angle = tooth * Math.PI / 4;
            this.box(top, [Math.cos(angle) * 0.2, 0.72, Math.sin(angle) * 0.2], [0.065, 0.06, 0.065], tooth === 0 ? 0x405356 : 0xb5925a);
          }
          const trip = new THREE.Group(); trip.name = `village-${station.stop}-trip`;
          trip.position.copy(top.position);
          this.groups[station.stop]!.add(trip);
          this.movers.push({ group: trip, station, auxiliary: 'striker' });
          this.box(trip, [cinematic?-.085:-.07, 0, 0.325], [0.06, 0.08, 0.65], 0xd3b578);
          const pitchAngle = mechanism.kind === 'escapement' ? mechanism.pitch ?? 0 : 0;
          if (pitchAngle !== 0) {
            const pitch = new THREE.Matrix4().makeRotationZ(pitchAngle), origin = new THREE.Vector3(...station.anchor);
            for (const auxiliary of [driven, gear, top, trip]) {
              auxiliary.position.sub(origin).applyMatrix4(pitch).add(origin);
              auxiliary.rotation.z = pitchAngle;
            }
          }
          if(cinematic){
            const bottom=new THREE.Vector3(0,-.8,0).applyQuaternion(top.quaternion).add(top.position),normal=new THREE.Vector3(0,1,0).applyQuaternion(top.quaternion),base=this.groundHeightAt(bottom.x,bottom.z);
            if(base===undefined||base>=bottom.y)throw Error('Clock rotor requires land below its bearing');
            const pedestal=new THREE.BoxGeometry(.12,bottom.y-base,.12).translate(bottom.x,(base+bottom.y)/2,bottom.z),vertices=pedestal.getAttribute('position');
            for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),z=vertices.getZ(i);if(vertices.getY(i)>base)vertices.setY(i,bottom.y-(normal.x*(x-bottom.x)+normal.z*(z-bottom.z))/normal.y);else{const land=this.groundHeightAt(x,z);if(land===undefined)throw Error('Clock bearing footprint crosses a void');vertices.setY(i,land);}}pedestal.computeVertexNormals();this.mesh(fixed,pedestal,0xb5925a).name=`village-${station.stop}-rotor-bearing`;
            const shaftFrame=new THREE.Matrix4().makeRotationZ(pitchAngle).setPosition(gear.position),shaft=new THREE.CylinderGeometry(.02,.02,.8,8).rotateZ(Math.PI/2).translate(.36,0,0).applyMatrix4(shaftFrame);
            this.mesh(fixed,shaft,0xb5925a).name=`village-${station.stop}-friction-shaft`;
            const bearing=new THREE.Vector3(.7,0,0).applyMatrix4(shaftFrame),bearingTop=bearing.y-.01,ground=this.groundHeightAt(bearing.x,bearing.z);
            if(ground===undefined||ground>=bearingTop)throw Error('Clock friction bearing requires land below its shaft');
            this.mesh(fixed,new THREE.BoxGeometry(.12,bearingTop-ground,.12).translate(bearing.x,(ground+bearingTop)/2,bearing.z),0x657578).name=`village-${station.stop}-friction-bearing`;
          }else this.support(station, [top.position.x + Math.sin(pitchAngle) * .45, top.position.y - Math.cos(pitchAngle) * .45, top.position.z]);
        }
      }
    }
  }
  /** Explicit native gate. Ground faces come from the actual visible land mesh,
   * not from a height callback or a names-only success flag. Call at actual home. */
  rockerInspection(stop:number){const b=this.rockerBindings.get(stop);if(!b)throw new Error('No native rocker parts');return b;}
  invalidateRockers():void{for(const stop of this.rockerBindings.keys())this.program?.invalidateGravityHinge(stop);}
  certifyRockers(ground:readonly NativeGroundFace[]):void{
    this.invalidateRockers();this.root.updateWorldMatrix(true,true);
    for(const[stop,b]of this.rockerBindings){const station=this.plan.stations.find(s=>s.stop===stop)!,rest=mechanismMatrix(station.mechanism,station.anchor,0,new THREE.Matrix4()),inverseRest=rest.clone().invert(),frame=(owner:THREE.Group,mesh:THREE.Object3D)=>{owner.updateWorldMatrix(true,true);if(mesh.matrixAutoUpdate)mesh.updateMatrix();return inverseRest.clone().multiply(relativeSceneMatrix(owner,this.root)).multiply(mesh.matrix);};
      const merged=(g:THREE.Group,body:'carrier'|'fixed'):NativeHingePart=>{const meshes=g.children.filter((o):o is THREE.Mesh=>o instanceof THREE.Mesh);if(meshes.length!==1)throw new Error('Expected final single merged rigid mesh');const mesh=meshes[0]!;return{id:'beam-boss',body,geometry:mesh.geometry,toStation:frame(g,mesh),owner:g};};
      const parts=b.parts.map(p=>({...p,toStation:frame(p.body==='carrier'?b.carrier:b.fixed,p.sourceMesh)}));
      this.program!.certifyGravityHinge(stop,{rootOwner:this.root,carrierOwner:b.carrier,fixedOwner:b.fixed,parts,mergedCarrier:merged(b.carrier,'carrier'),mergedFixed:merged(b.fixed,'fixed'),ground,groundHeight:this.groundHeightAt});
    }
  }
  /** Seals native supports at their final home (staged) and returns their scene-lifetime proof owner. */
  *sealStaticProof(backend:StaticProofBackend,eligible:()=>boolean,scheduler:TaskScheduler,sliceMs?:number):Generator<unknown,StaticProofOwner|undefined,void>{if(!this.staticConstruction)return undefined;if(this.staticProof)throw Error('Repeated static support enrollment');const sealed=yield* this.staticConstruction.seal();this.staticProof=new StaticProofOwner(sealed,backend,eligible,scheduler,sliceMs);return this.staticProof;}
  staticSupportInspection(){const s=this.staticProof?.status;return this.staticConstruction?{posts:this.staticConstruction.inspectSources(),native:this.staticConstruction.inspectNative(),seats:this.staticConstruction.inspectSeats(),certificate:s?.state==='ready'?s.certificate:undefined,proof:s}:undefined;}
  private merge(group: THREE.Group): void {
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const meshes: THREE.Mesh[] = [];
    group.traverse(child => { if (child instanceof THREE.Mesh) meshes.push(child); });
    if (meshes.length < 1) return;
    let first=0;let axleBase:number|undefined;const feet: {first:number;count:number;descriptor:NonNullable<ReturnType<typeof terrainFootDescriptor>>}[]=[];
    const supportOps=this.staticConstruction?[]as THREE.Matrix4[]:undefined;
    const axleTracks:{source:THREE.Mesh;first:number;piece:THREE.BufferGeometry;operator:THREE.Matrix4}[]=[];
    const pieces = meshes.map(mesh => {
      if(mesh===this.axleFixedSource?.mesh)axleBase=first;
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      const count=geometry.getAttribute('position').count,descriptor=terrainFootDescriptor(mesh.geometry);if(descriptor)feet.push({first,count,descriptor});first+=count;
      const applied=inverse.clone().multiply(mesh.matrixWorld);supportOps?.push(applied);geometry.applyMatrix4(applied);if([...this.axleNeighbours.values()].includes(mesh)||[...this.axleSplices.values()].some(s=>s.source===mesh))axleTracks.push({source:mesh,first:first-count,piece:geometry,operator:applied});return geometry;
    });
    const merged = mergeGeometries(pieces);if(!this.staticConstruction)pieces.forEach(piece=>piece.dispose());
    if(!merged){if(this.staticConstruction)pieces.forEach(p=>p.dispose());throw new Error('Village geometry attributes do not match');}
    const actual=new THREE.Mesh(merged,this.material);
    for(const t of axleTracks)this.axleTrackRanges.set(t.source,{mesh:actual,home:group,first:t.first,count:t.piece.getAttribute('position').count,position:new Float32Array(t.piece.getAttribute('position').array),normal:new Float32Array(t.piece.getAttribute('normal').array),color:new Float32Array(t.piece.getAttribute('color').array),geometry:merged,attributes:['position','normal','color'].map(n=>merged.getAttribute(n)as THREE.BufferAttribute),arrays:['position','normal','color'].map(n=>merged.getAttribute(n).array),versions:['position','normal','color'].map(n=>(merged.getAttribute(n)as THREE.BufferAttribute).version),counts:['position','normal','color'].map(n=>merged.getAttribute(n).count),operator:t.operator.clone()});
    if(this.staticConstruction){group.add(actual);actual.updateWorldMatrix(true,true);let offset=0;for(let i=0;i<meshes.length;i++){const piece=pieces[i]!,count=piece.getAttribute('position').count;this.staticConstruction.native.bind(meshes[i]!,actual,offset,count,piece,supportOps![i]!,group);offset+=count;}pieces.forEach(p=>p.dispose());}
    meshes.forEach(mesh=>mesh.removeFromParent());this.geometries.add(merged);if(!this.staticConstruction){group.add(actual);actual.updateWorldMatrix(true,true);}if(axleBase!==undefined)this.axleFixedSource!.binding.rebindFixed(actual,axleBase);for(const f of feet)this.footBindings.push(bindTerrainFoot(f.descriptor.owner,actual,f.first,f.count,f.descriptor));
  }
}
