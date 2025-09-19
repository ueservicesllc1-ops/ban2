// src/app/actions.ts
'use server';

import {
  suggestOptimalPlacements,
  SuggestOptimalPlacementsInput,
  SuggestOptimalPlacementsOutput,
} from '@/ai/flows/suggest-optimal-placements';

export async function getPlacementSuggestions(
  input: SuggestOptimalPlacementsInput
): Promise<{ success: true; data: SuggestOptimalPlacementsOutput } | { success: false; error: string }> {
  try {
    const result = await suggestOptimalPlacements(input);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error in getPlacementSuggestions:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to get suggestions from AI. ${errorMessage}` };
  }
}
