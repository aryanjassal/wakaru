import type { MiningCandidate, TuiMiningStatus } from '@/tui/lib/types';

export type MineState = Readonly<{
  contextText: string;
  wordText: string;
  showDetails: boolean;
  showContext: boolean;
  status: TuiMiningStatus;
  candidates: readonly MiningCandidate[];
  selectedCandidateId: string | null;
}>;

export type InputSnapshot = Readonly<{
  contextText: string;
  wordText: string;
}>;
