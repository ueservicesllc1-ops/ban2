// src/ai/flows/suggest-optimal-placements.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow that suggests optimal placements for a logo and text on a banner image using AI.
 *
 * The flow takes the banner image, logo image, and text as input and returns suggested placements for the logo and text.
 * It exports:
 *   - `suggestOptimalPlacements`: The main function to call to get placement suggestions.
 *   - `SuggestOptimalPlacementsInput`: The input type for the function.
 *   - `SuggestOptimalPlacementsOutput`: The output type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema
const SuggestOptimalPlacementsInputSchema = z.object({
  bannerImageDataUri: z
    .string()
    .describe(
      'The banner image as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Corrected typo here
    ),
  logoImageDataUri: z
    .string()
    .describe(
      'The logo image as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Corrected typo here
    ),
  text: z.string().describe('The text to overlay on the banner.'),
});

export type SuggestOptimalPlacementsInput = z.infer<
  typeof SuggestOptimalPlacementsInputSchema
>;

// Define the output schema
const SuggestOptimalPlacementsOutputSchema = z.object({
  logoPlacement: z
    .string()
    .describe(
      'Suggested placement for the logo (e.g., top-left, bottom-right, etc.).'
    ),
  textPlacement: z
    .string()
    .describe(
      'Suggested placement for the text (e.g., top-center, bottom-left, etc.).'
    ),
  reasoning: z
    .string()
    .describe(
      'The AI explanation for why the logo and text placements are optimal.'
    ),
});

export type SuggestOptimalPlacementsOutput = z.infer<
  typeof SuggestOptimalPlacementsOutputSchema
>;

// Define the flow function
export async function suggestOptimalPlacements(
  input: SuggestOptimalPlacementsInput
): Promise<SuggestOptimalPlacementsOutput> {
  return suggestOptimalPlacementsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestOptimalPlacementsPrompt',
  input: {schema: SuggestOptimalPlacementsInputSchema},
  output: {schema: SuggestOptimalPlacementsOutputSchema},
  prompt: `You are an AI expert in visual design and marketing.
  Given a banner image, a logo, and text, your task is to suggest the most visually appealing and effective placements for the logo and text on the banner.

  Consider factors such as:
  - Visual balance
  - Readability
  - Brand visibility
  - Overall aesthetic appeal

  Here is the banner image: {{media url=bannerImageDataUri}}
  Here is the logo: {{media url=logoImageDataUri}}
  Here is the text: {{{text}}}

  Provide the suggested logo placement, text placement, and a brief explanation of your reasoning.

  Output in JSON format:
  {
    "logoPlacement": "Suggested logo placement",
    "textPlacement": "Suggested text placement",
    "reasoning": "Explanation for the placement choices"
  }`,
});

const suggestOptimalPlacementsFlow = ai.defineFlow(
  {
    name: 'suggestOptimalPlacementsFlow',
    inputSchema: SuggestOptimalPlacementsInputSchema,
    outputSchema: SuggestOptimalPlacementsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
