import type {
  AssistantCandidateExtension,
  MiningCandidate,
} from '@/core/types.js';

export type ClientCandidateExtension = AssistantCandidateExtension;
export type ClientCandidate = MiningCandidate<ClientCandidateExtension>;

export type SavedWord = Readonly<{
  candidate: ClientCandidate;
  sourceText: string;
  createdAt: string;
}>;
