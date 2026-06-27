import type { MiningCandidate, TuiMiningStatus } from '@/tui/types';

export type MineState = Readonly<{
  contextText: string;
  wordText: string;
  showDetails: boolean;
  showContext: boolean;
  status: TuiMiningStatus;
  statusMessage: string;
  errorMessage: string | null;
  candidates: readonly MiningCandidate[];
  selectedCandidateId: string | null;
}>;

export type InputSnapshot = Readonly<{
  contextText: string;
  wordText: string;
}>;
