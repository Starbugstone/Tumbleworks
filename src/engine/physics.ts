import RAPIER from '@dimforge/rapier3d-compat';

export const FIXED_SECONDS = 1 / 60;
export const FALLING_GROUPS = (0x0001 << 16) | 0xffff;
export const PLACED_GROUPS = (0x0002 << 16) | 0;
export interface Point3 { x: number; y: number; z: number }

/** All gameplays share initialization, tick length and marble-body construction. */
export class PhysicsService {
  private ready: Promise<void> | undefined;
  init(): Promise<void> { return this.ready ??= RAPIER.init(); }

  createWorld(gravity = 34): RAPIER.World {
    const world = new RAPIER.World({ x: 0, y: -gravity, z: 0 });
    world.timestep = FIXED_SECONDS;
    return world;
  }

  marble(world: RAPIER.World, radius: number, at: Point3, dynamic = false, restitution = 0.5): RAPIER.RigidBody {
    const description = dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.kinematicPositionBased();
    const body = world.createRigidBody(description.setTranslation(at.x, at.y, at.z)
      .setCcdEnabled(true).setCanSleep(false).setLinearDamping(0.02).setAngularDamping(0.12));
    world.createCollider(RAPIER.ColliderDesc.ball(radius)
      .setDensity(1 / ((4 / 3) * Math.PI * radius ** 3)).setFriction(0.32)
      .setRestitution(restitution).setCollisionGroups(dynamic ? FALLING_GROUPS : PLACED_GROUPS), body);
    return body;
  }
}

export const physics = new PhysicsService();

/** A reusable real-physics landing. Transport to the release point stays scripted. */
export class MarbleDrop {
  readonly world: RAPIER.World;
  private readonly body: RAPIER.RigidBody;
  private elapsed = 0;
  private stillTicks = 0;
  done = false;

  constructor(service: PhysicsService, readonly target: Point3, radius: number, height = 0.6) {
    this.world = service.createWorld();
    this.body = service.marble(this.world, radius, { ...target, y: target.y + height }, true, 0.26);
    const floor = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(radius * 1.5, 0.08, radius * 1.5)
      .setTranslation(target.x, target.y - radius - 0.08, target.z).setRestitution(0.25), floor);
  }

  step(): Point3 {
    if (this.done) return this.target;
    this.world.step();
    this.elapsed += FIXED_SECONDS;
    const at = this.body.translation();
    const velocity = this.body.linvel();
    if (Math.abs(at.y - this.target.y) < 0.025 && Math.abs(velocity.y) < 0.25) this.stillTicks++;
    else this.stillTicks = 0;
    this.done = this.stillTicks >= 4 || this.elapsed >= 0.9;
    return this.done ? this.target : { x: at.x, y: at.y, z: at.z };
  }

  dispose(): void { this.world.free(); }
}
