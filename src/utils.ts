export type PassType = 'forward' | 'backward'

export type CellData = {
  value: number | null
  passType: PassType | null
}

export type GridData = CellData[][]

/**
 * Creates an empty grid with the specified dimensions
 */
export function createEmptyGrid(numGPUs: number, numTimesteps: number): GridData {
  return Array(numGPUs).fill(null).map(() => 
    Array(numTimesteps).fill(null).map(() => ({
      value: null,
      passType: null
    }))
  )
}

/**
 * Creates a default grid with diagonal patterns of 1s and 2s for forward and backward passes
 */
export function createDefaultGrid(numGPUs: number, numTimesteps: number): GridData {
  const grid = createEmptyGrid(numGPUs, numTimesteps)

  // Forward pass diagonal: GPU 0 at time 0, GPU 1 at time 1, etc. (value 1)
  for (let i = 0; i < Math.min(numGPUs, numTimesteps); i++) {
    grid[i][i] = {
      value: 1,
      passType: 'forward'
    }
  }

  // Forward pass diagonal: GPU 0 at time 1, GPU 1 at time 2, etc. (value 2, following the 1s)
  for (let i = 0; i < Math.min(numGPUs, numTimesteps - 1); i++) {
    const timeIdx = i + 1
    if (timeIdx < numTimesteps) {
      grid[i][timeIdx] = {
        value: 2,
        passType: 'forward'
      }
    }
  }

  // Backward pass diagonal going back up: GPU (numGPUs-1) at time numGPUs+1, GPU (numGPUs-2) at time numGPUs+2, etc. (value 1)
  // Starting one timestep later to make space for the 2s
  const backwardStartTime = numGPUs + 1
  for (let i = 0; i < Math.min(numGPUs, numTimesteps - backwardStartTime); i++) {
    const gpuIdx = numGPUs - 1 - i
    const timeIdx = backwardStartTime + i
    if (gpuIdx >= 0 && timeIdx < numTimesteps) {
      grid[gpuIdx][timeIdx] = {
        value: 1,
        passType: 'backward'
      }
    }
  }

  // Backward pass diagonal going back up: following the backward 1s (value 2)
  // Moving this to after the first backward pass to avoid collisions
  const backward2StartTime = numGPUs + 2
  for (let i = 0; i < Math.min(numGPUs, numTimesteps - backward2StartTime); i++) {
    const gpuIdx = numGPUs - 1 - i
    const timeIdx = backward2StartTime + i
    if (gpuIdx >= 0 && timeIdx < numTimesteps) {
      grid[gpuIdx][timeIdx] = {
        value: 2,
        passType: 'backward'
      }
    }
  }

  return grid
}

/**
 * Calculates the number of blank (empty) cells in the grid
 */
export function calculateBlankCount(gridData: GridData): number {
  return gridData.reduce((count, row) => 
    count + row.filter(cell => cell.value === null).length, 0
  )
}

/**
 * Generates a color based on batch number and pass type
 */
export function getColorForBatch(batchNumber: number, passType: PassType | null): string {
  if (batchNumber === null) return 'transparent';
  
  // Create a rainbow-ordered hue starting from Green (120)
  // Using a 50-degree step to hit Green (120), Blue (approx 220), Indigo (270), Violet (320)
  const hue = (120 + ((batchNumber - 1) * 50)) % 360;
  
  // Forward pass is darker, backward pass is lighter
  const saturation = 70;
  const lightness = passType === 'forward' ? 40 : 60;
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

