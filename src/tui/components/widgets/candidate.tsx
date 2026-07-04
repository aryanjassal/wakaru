import type { MiningCandidate } from '@/tui/lib/types';

import { colorscheme } from '@/tui/lib/theme';
import { humaniseTag } from '@/tui/lib/utils';
import { TextAttributes } from '@opentui/core';

type CandidateProps = {
  candidate: MiningCandidate;
  addedCandidateIds?: ReadonlySet<MiningCandidate['id']>;
  focused?: boolean;
};

export function Candidate({
  candidate,
  addedCandidateIds,
  focused,
}: CandidateProps) {
  const bg = focused ? colorscheme.primary : colorscheme.bg;
  const fg = focused ? colorscheme.bg : colorscheme.fg;
  const muted = focused ? colorscheme.bgHighlight : colorscheme.muted;
  const attributes = focused ? TextAttributes.BOLD : TextAttributes.NONE;
  const status = addedCandidateIds
    ? addedCandidateIds.has(candidate.id)
      ? 'SAVED'
      : 'NEW'
    : 'UNKNOWN';

  return (
    <box flexDirection="column" columnGap={2} backgroundColor={bg} paddingX={2}>
      <box flexDirection="row" columnGap={2}>
        <text fg={fg} attributes={attributes}>
          {candidate.expression}
        </text>
        <text fg={fg} attributes={attributes}>
          ({candidate.reading})
        </text>
        <text fg={muted} attributes={attributes}>
          ·
        </text>
        <text fg={muted} attributes={attributes}>
          {candidate.extension?.tags.map(humaniseTag).join(';')}
        </text>
      </box>
      <box flexDirection="column" columnGap={2}>
        <text fg={fg} attributes={attributes}>
          {candidate.meanings.join('; ')}
        </text>
      </box>
      <box flexDirection="column" columnGap={2}>
        <text fg={muted} attributes={attributes} paddingLeft={4}>
          {status}
        </text>
      </box>
    </box>
  );
}
