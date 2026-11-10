import { t } from '../i18n';
import { worldLocation } from './locations';
import type { WorldProgress } from './progression';

export type ProjectReward = 'gantry' | 'bells' | 'waterwheel' | 'cistern' | 'gate' | 'windmill' | 'terrace';

export interface WorkshopProject {
  readonly id: string;
  readonly chapter: number;
  readonly stops: number;
  readonly reward: ProjectReward;
  readonly title: string;
  readonly rewardTitle: string;
}

function project(id: string, chapter: number, stops: number, reward: ProjectReward, english: string, french: string): WorkshopProject {
  return {
    id, chapter, stops, reward,
    get title() { return t(english, french); },
    get rewardTitle() { return t(english, french); },
  };
}

/** Stable Workshop saves earn village additions without entering the campaign's construction rounds. */
export const WORKSHOP_PROJECTS: readonly WorkshopProject[] = [
  project('board-210', 0, 2, 'gantry', 'Cargo gantry', 'Le portique à cargaisons'),
  project('board-212', 0, 7, 'bells', 'Twin-bell pavilion', 'Le pavillon aux deux cloches'),
  project('loop-210', 1, 3, 'waterwheel', 'Garden waterwheel', 'La roue à eau des jardins'),
  project('tube-210', 2, 4, 'cistern', 'Rain collector', 'Le récupérateur de pluie'),
  project('board-211', 3, 3, 'gate', 'Clockwork gate', 'La porte d’horlogerie'),
  project('loop-211', 4, 5, 'windmill', 'Bridge windmill', 'Le moulin du pont'),
  project('tube-211', 5, 6, 'terrace', 'Glass terrace', 'La terrasse de verre'),
];

export function workshopProject(id: string): WorkshopProject | undefined {
  return WORKSHOP_PROJECTS.find(candidate => candidate.id === id);
}

export interface ProjectState {
  readonly status: 'locked' | 'available' | 'completed';
  readonly built: number;
  readonly required: number;
  readonly label: string;
}

/** Count complete local stops, including older out-of-order wins, rather than the campaign frontier. */
export function projectState(project: WorkshopProject, progress: WorldProgress, completed: ReadonlySet<string>): ProjectState {
  const chapter = progress.chapters.find(candidate => candidate.index === project.chapter);
  const built = chapter?.stops.filter(stop => stop.status === 'built').length ?? 0;
  const status = completed.has(project.id) ? 'completed'
    : chapter?.available && built >= project.stops ? 'available' : 'locked';
  const village = worldLocation(project.chapter).name;
  const label = status === 'locked'
    ? t(`Locked · ${village}: ${built} of ${project.stops} stops built`, `Verrouillé · ${village} : ${built} ${built === 1 ? 'étape construite' : 'étapes construites'} sur ${project.stops}`)
    : status === 'completed' ? t(`Built · ${village}`, `Construit · ${village}`)
      : t(`Ready to build · ${village}`, `Prêt à construire · ${village}`);
  return { status, built, required: project.stops, label };
}

export function canEnterProject(id: string, progress: WorldProgress, completed: ReadonlySet<string>): boolean {
  const project = workshopProject(id);
  return project !== undefined && projectState(project, progress, completed).status !== 'locked';
}

/** Previously earned additions survive a changed gate or an older save with no campaign prefix. */
export function earnedProjects(completed: ReadonlySet<string>): readonly WorkshopProject[] {
  return WORKSHOP_PROJECTS.filter(project => completed.has(project.id));
}
