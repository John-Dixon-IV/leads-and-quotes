/**
 * Math Validation Utilities
 *
 * Validates dimension calculations and detects discrepancies
 */

export interface DimensionInfo {
  width?: number;
  length?: number;
  calculatedArea?: number;
  statedArea?: number;
  unit: string;
  hasMismatch: boolean;
  correctedValue?: number;
}

/**
 * Extract dimensions from text (e.g., "10x20", "10 by 20", "10 feet by 20 feet")
 */
export function extractDimensions(text: string): { width: number; length: number } | null {
  if (!text) return null;

  const normalized = text.toLowerCase();

  // Pattern 1: "10x20", "10 x 20"
  let match = normalized.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/);
  if (match) {
    return {
      width: parseFloat(match[1]),
      length: parseFloat(match[2]),
    };
  }

  // Pattern 2: "10 by 20", "10 feet by 20 feet"
  match = normalized.match(/(\d+\.?\d*)\s*(?:feet?|ft|')?\s*by\s*(\d+\.?\d*)\s*(?:feet?|ft|')?/);
  if (match) {
    return {
      width: parseFloat(match[1]),
      length: parseFloat(match[2]),
    };
  }

  return null;
}

/**
 * Extract stated area from text (e.g., "500 sqft", "500 square feet")
 */
export function extractStatedArea(text: string): number | null {
  if (!text) return null;

  const normalized = text.toLowerCase();

  // Pattern: "500 sqft", "500 square feet", "500 sq ft"
  const match = normalized.match(/(\d+\.?\d*)\s*(?:sq\.?\s*f(?:ee)?t|square\s*f(?:ee)?t|sqft)/);
  if (match) {
    return parseFloat(match[1]);
  }

  return null;
}

/**
 * Validate dimensions and detect math discrepancies
 */
export function validateDimensions(conversationText: string): DimensionInfo {
  const dimensions = extractDimensions(conversationText);
  const statedArea = extractStatedArea(conversationText);

  const result: DimensionInfo = {
    unit: 'sq_ft',
    hasMismatch: false,
  };

  if (dimensions) {
    result.width = dimensions.width;
    result.length = dimensions.length;
    result.calculatedArea = dimensions.width * dimensions.length;
  }

  if (statedArea) {
    result.statedArea = statedArea;
  }

  // Check for mismatch (allow 5% tolerance for rounding)
  if (result.calculatedArea && result.statedArea) {
    const tolerance = result.calculatedArea * 0.05;
    const diff = Math.abs(result.calculatedArea - result.statedArea);

    if (diff > tolerance) {
      result.hasMismatch = true;
      result.correctedValue = result.calculatedArea;
    }
  }

  return result;
}

/**
 * Generate correction message for assistant
 */
export function generateCorrectionMessage(dimensionInfo: DimensionInfo): string {
  if (!dimensionInfo.hasMismatch || !dimensionInfo.correctedValue) {
    return '';
  }

  const { width, length, statedArea, correctedValue } = dimensionInfo;

  return `Just to confirm: a ${width}x${length} area is ${correctedValue} square feet (not ${statedArea} sqft). I'll base the estimate on ${correctedValue} square feet. `;
}
