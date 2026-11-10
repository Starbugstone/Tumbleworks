import type { GameRuntime, GuideStep } from '../engine/contracts';
import type { ReplayAction } from '../engine/replay';
import { t } from '../i18n';

type GuideAction =
  | { readonly type: 'tap'; readonly at: number; readonly target: 'supply' | 'lane' }
  | { readonly type: 'move'; readonly from: number; readonly to: number };

/** First two accepted actions of retained physical witnesses, or the authored Tube Sort solution. */
const PREFIXES: Readonly<Record<string, readonly GuideAction[]>> = {
  'board-210': [{ type: 'tap', at: 4, target: 'supply' }, { type: 'tap', at: 5, target: 'supply' }],
  'board-211': [{ type: 'tap', at: 0, target: 'supply' }, { type: 'tap', at: 1, target: 'supply' }],
  'board-212': [{ type: 'tap', at: 0, target: 'supply' }, { type: 'tap', at: 0, target: 'supply' }],
  'loop-210': [{ type: 'tap', at: 0, target: 'lane' }, { type: 'tap', at: 2, target: 'lane' }],
  'loop-211': [{ type: 'tap', at: 0, target: 'lane' }, { type: 'tap', at: 2, target: 'lane' }],
  'tube-210': [{ type: 'move', from: 0, to: 3 }, { type: 'move', from: 1, to: 3 }],
  'tube-211': [{ type: 'move', from: 1, to: 3 }, { type: 'move', from: 0, to: 1 }],
};

function matches(expected: GuideAction, actual: ReplayAction): boolean {
  return expected.type === 'tap' ? actual.type === 'tap' && actual.at === expected.at
    : actual.type === 'move' && actual.from === expected.from && actual.to === expected.to;
}

const done = (): GuideStep => ({
  done: true,
  text: t('Keep matching to finish the project. Undo and hints are always available.', 'Continuez les associations pour terminer le projet. Vous pouvez toujours annuler ou demander un indice.'),
});

/** Workshop factories opt in; the runtime, input methods and replayable rule state retain their identity. */
export function attachProjectGuide<T extends GameRuntime>(runtime: T, id: string, instructions: string | (() => string)): T {
  const prefix = Object.hasOwn(PREFIXES, id) ? PREFIXES[id] : undefined;
  if (!prefix) return runtime;
  let processed = 0;
  const accepted: Exclude<ReplayAction, { readonly type: 'undo' }>[] = [];
  const guide = (): GuideStep => {
    const actions = runtime.game.actions;
    // Consume only new journal entries; repeated draws do not rescan a history of undone moves.
    while (processed < actions.length) {
      const action = actions[processed++]!;
      if (action.type === 'undo') accepted.pop();
      else accepted.push(action);
    }
    if (runtime.status !== 'playing' || accepted.length >= prefix.length) return done();
    for (let index = 0; index < accepted.length; index++) {
      const expected = prefix[index], actual = accepted[index];
      if (!expected || !actual || !matches(expected, actual)) return done();
    }
    const next = prefix[accepted.length];
    if (!next) return done();
    const explanation = accepted.length === 0 ? `${typeof instructions === 'function' ? instructions() : instructions} ` : '';
    if (next.type === 'move') {
      const selected = runtime.inspect().selected;
      if (typeof selected === 'number' && selected !== next.from) return {
        target: `tube${selected}`,
        text: t('Tap this tube again to clear your selection.', 'Touchez de nouveau ce tube pour annuler la sélection.'),
      };
      return selected === next.from
        ? { target: `tube${next.to}`, text: `${explanation}${t('Now tap here to move the matching group.', 'Touchez maintenant ici pour déplacer le groupe de même couleur.')}` }
        : { target: `tube${next.from}`, text: `${explanation}${t('Tap this tube to select its top group. Dragging works too.', 'Touchez ce tube pour sélectionner le groupe du haut. Vous pouvez aussi le faire glisser.')}` };
    }
    return {
      target: `${next.target}${next.at}`,
      text: `${explanation}${next.target === 'supply'
        ? t('Tap this crate to release its marbles.', 'Touchez cette caisse pour libérer ses billes.')
        : t('Tap this truck to pour its open-end group.', 'Touchez ce camion pour verser le groupe au bout de sa benne.')}`,
    };
  };
  Object.defineProperties(runtime, {
    guideId: { configurable: true, get: () => `project-${id}` },
    guide: { configurable: true, value: guide },
  });
  return runtime;
}
