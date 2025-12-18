import { useState, useCallback, useMemo, useRef } from 'react'
import './App.css'
import { type GridData, type PassType, createDefaultGrid, calculateBlankCount, getColorForBatch } from './utils'

type FlowVisualizationProps = {
  gridData: GridData
  numGPUs: number
  numTimesteps: number
  svgRef?: React.RefObject<SVGSVGElement>
}

function FlowVisualization({ gridData, numGPUs, numTimesteps, svgRef }: FlowVisualizationProps) {
  // Calculate memory usage for each GPU at each timestep
  const memoryUsage = useMemo(() => {
    const memory: number[][] = Array(numGPUs).fill(null).map(() => Array(numTimesteps).fill(0))
    
    // For each GPU, track which batches are currently in memory
    for (let gpuIdx = 0; gpuIdx < numGPUs; gpuIdx++) {
      const batchesInMemory = new Set<number>()
      
      for (let timeIdx = 0; timeIdx < numTimesteps; timeIdx++) {
        const cell = gridData[gpuIdx][timeIdx]
        
        // Process events at this timestep
        if (cell.value !== null && cell.passType) {
          if (cell.passType === 'forward') {
            // Forward pass: add batch to memory
            batchesInMemory.add(cell.value)
          } else if (cell.passType === 'backward') {
            // Backward pass: remove batch from memory
            batchesInMemory.delete(cell.value)
          }
        }
        
        // Record current memory usage at this timestep (after processing events)
        memory[gpuIdx][timeIdx] = batchesInMemory.size
      }
    }
    
    return memory
  }, [gridData, numGPUs, numTimesteps])

  // Collect all cells with their positions
  const allCells: Array<{ value: number; timeIdx: number; gpuIdx: number; passType: PassType }> = []
  
  gridData.forEach((row, gpuIdx) => {
    row.forEach((cell, timeIdx) => {
      if (cell.value !== null && cell.passType) {
        allCells.push({
          value: cell.value,
          timeIdx,
          gpuIdx,
          passType: cell.passType
        })
      }
    })
  })

  // Group cells by value
  const valueGroups: { [key: number]: Array<{ timeIdx: number; gpuIdx: number; passType: PassType }> } = {}
  allCells.forEach(cell => {
    if (!valueGroups[cell.value]) {
      valueGroups[cell.value] = []
    }
    valueGroups[cell.value].push(cell)
  })

  // Get all unique batch values to create markers for each
  const uniqueBatches = useMemo(() => {
    const batches = new Set<number>()
    allCells.forEach(cell => batches.add(cell.value))
    return Array.from(batches)
  }, [allCells])

  // Calculate dimensions - matching top grid
  const cellWidth = 38 // Match grid-cell width exactly
  const rowSpacing = 30 // Match border-bottom spacing
  const headerHeight = 28 // Match header-cell height
  const headerRowGap = 25 // Space between header and first GPU row (for memory chart)
  const rowLabelWidth = 60 // Match row-label width
  const startX = rowLabelWidth // Start right after the label, matching top grid
  const svgWidth = numTimesteps * cellWidth + rowLabelWidth
  const rowHeight = 32 // Match grid-cell height exactly
  const svgHeight = headerHeight + headerRowGap + numGPUs * (rowHeight + rowSpacing) - rowSpacing

  // Generate edges - connect nodes with same value in sequence
  const edges: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
    passType: PassType
    value: number
  }> = []

  Object.entries(valueGroups).forEach(([value, positions]) => {
    if (positions.length < 2) return
    
    // Sort by timestep, then by GPU
    const sorted = positions.sort((a, b) => {
      if (a.timeIdx !== b.timeIdx) return a.timeIdx - b.timeIdx
      return a.gpuIdx - b.gpuIdx
    })
    
    // Connect consecutive nodes
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i]
      const to = sorted[i + 1]
      
      const rowY = headerHeight + headerRowGap + from.gpuIdx * (rowHeight + rowSpacing) + rowHeight / 2
      const nextRowY = headerHeight + headerRowGap + to.gpuIdx * (rowHeight + rowSpacing) + rowHeight / 2
      
      edges.push({
        x1: startX + from.timeIdx * cellWidth + cellWidth / 2,
        y1: rowY,
        x2: startX + to.timeIdx * cellWidth + cellWidth / 2,
        y2: nextRowY,
        passType: from.passType,
        value: Number(value)
      })
    }
  })

  // Ensure minimum dimensions for display
  const calculatedHeight = headerHeight + headerRowGap + numGPUs * (rowHeight + rowSpacing) - rowSpacing
  const minHeight = Math.max(svgHeight, calculatedHeight || 200)

  return (
    <svg 
      ref={svgRef}
      className="flow-svg" 
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width={svgWidth}
      height={minHeight}
      preserveAspectRatio="xMinYMin meet"
    >
      {/* Background */}
      <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#242424" />
      
      {/* Header background */}
      <rect 
        x="0" 
        y="0" 
        width={svgWidth} 
        height={headerHeight} 
        fill="rgba(255, 255, 255, 0.15)" 
      />
      <line
        x1="0"
        y1={headerHeight}
        x2={svgWidth}
        y2={headerHeight}
        stroke="#d3d3d3"
        strokeWidth="1"
      />
      
      <line
        x1={rowLabelWidth}
        y1="0"
        x2={rowLabelWidth}
        y2={headerHeight}
        stroke="#d3d3d3"
        strokeWidth="1"
      />
      
      {/* Timestep labels header */}
      {Array(numTimesteps).fill(0).map((_, timeIdx) => (
        <g key={`time-label-${timeIdx}`}>
          <text
            x={startX + timeIdx * cellWidth + cellWidth / 2}
            y={headerHeight - 6}
            fill="#ffffff"
            fontSize="9.6"
            fontWeight="600"
            fontFamily="sans-serif"
            textAnchor="middle"
          >
            t{timeIdx}
          </text>
        </g>
      ))}
      
      {/* GPU row backgrounds and grid lines */}
      {gridData.map((_, gpuIdx) => {
        const rowY = headerHeight + headerRowGap + gpuIdx * (rowHeight + rowSpacing)
        
        return (
          <g key={`row-${gpuIdx}`}>
            {/* White row background - exactly 32px tall */}
            <rect
              x={rowLabelWidth}
              y={rowY}
              width={svgWidth - rowLabelWidth}
              height={rowHeight}
              fill="white"
              stroke="#e0e0e0"
              strokeWidth="2"
            />
            
            {/* Vertical grid lines - align with cell boundaries */}
            {Array(numTimesteps + 1).fill(0).map((_, timeIdx) => {
              const lineX = startX + timeIdx * cellWidth
              return (
                <line
                  key={`vline-${timeIdx}`}
                  x1={lineX}
                  y1={rowY}
                  x2={lineX}
                  y2={rowY + rowHeight}
                  stroke="#d3d3d3"
                  strokeWidth="1"
                />
              )
            })}
            
            
            {/* Bottom border */}
            <line
              x1={rowLabelWidth}
              y1={rowY + rowHeight}
              x2={svgWidth}
              y2={rowY + rowHeight}
              stroke="#d3d3d3"
              strokeWidth="1"
            />
          </g>
        )
      })}
      
      <defs>
        {uniqueBatches.map(batch => (
          <g key={`markers-batch-${batch}`}>
            <marker
              id={`arrowhead-forward-${batch}`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill={getColorForBatch(batch, 'forward')} />
            </marker>
            <marker
              id={`arrowhead-backward-${batch}`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill={getColorForBatch(batch, 'backward')} />
            </marker>
          </g>
        ))}
        <marker
          id="arrowhead-memory"
          markerWidth="5"
          markerHeight="5"
          refX="4.5"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0 0, 5 2.5, 0 5" fill="rgba(255, 255, 255, 0.7)" />
        </marker>
      </defs>

      {/* Draw edges first (so they appear behind nodes) */}
      {edges.map((edge, idx) => (
        <line
          key={`edge-${edge.value}-${idx}`}
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          stroke={getColorForBatch(edge.value, edge.passType)}
          strokeWidth="2"
          strokeOpacity="0.6"
          markerEnd={`url(#arrowhead-${edge.passType}-${edge.value})`}
        />
      ))}

      {/* Memory label - positioned above first GPU label */}
      <text
        x={rowLabelWidth / 2}
        y={headerHeight + headerRowGap / 2}
        fill="#ffffff"
        fontSize="9.6"
        fontWeight="600"
        fontFamily="sans-serif"
        textAnchor="middle"
        dominantBaseline="middle"
        opacity="0.8"
      >
        Memory
      </text>
      
      {/* Arrow from Memory label to first memory area chart */}
      {memoryUsage[0] && Math.max(...memoryUsage[0]) > 0 && (
        <line
          x1={rowLabelWidth / 2 + 20}
          y1={headerHeight + headerRowGap / 2}
          x2={startX + cellWidth / 2}
          y2={headerHeight + headerRowGap - 12}
          stroke="rgba(255, 255, 255, 0.5)"
          strokeWidth="1.5"
          markerEnd="url(#arrowhead-memory)"
        />
      )}

      {/* GPU row labels */}
      {gridData.map((_, gpuIdx) => {
        const rowY = headerHeight + headerRowGap + gpuIdx * (rowHeight + rowSpacing)
        const rowCenterY = rowY + rowHeight / 2
        
        return (
          <g key={`gpu-label-${gpuIdx}`}>
            {/* GPU label background */}
            <rect
              x="0"
              y={rowY}
              width={rowLabelWidth}
              height={rowHeight}
              fill="rgba(255, 255, 255, 0.1)"
            />
            <line
              x1={rowLabelWidth}
              y1={rowY}
              x2={rowLabelWidth}
              y2={rowY + rowHeight}
              stroke="#d3d3d3"
              strokeWidth="1"
            />
            {/* GPU label text */}
            <text
              x={rowLabelWidth / 2}
              y={rowCenterY}
              fill="#ffffff"
              fontSize="12.8"
              fontWeight="600"
              fontFamily="sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              GPU {gpuIdx}
            </text>
          </g>
        )
      })}

      {/* Draw nodes */}
      {gridData.map((row, gpuIdx) => {
        const rowY = headerHeight + headerRowGap + gpuIdx * (rowHeight + rowSpacing)
        const rowCenterY = rowY + rowHeight / 2
        
        return (
          <g key={`gpu-${gpuIdx}`}>
            
            {/* Nodes for each filled cell */}
            {row.map((cell, timeIdx) => {
              if (cell.value === null) return null
              
              // Center the node in the cell (cell is 38px wide, node is 30px wide)
              const x = startX + timeIdx * cellWidth + cellWidth / 2
              const y = rowCenterY
              
              return (
                <g key={`node-${gpuIdx}-${timeIdx}`}>
                <rect
                  x={x - cellWidth / 2}
                  y={y - rowHeight / 2}
                  width={cellWidth}
                  height={rowHeight}
                  fill={getColorForBatch(cell.value, cell.passType)}
                  stroke="white"
                  strokeWidth="1"
                />
                  <text
                    x={x}
                    y={y}
                    fill="#ffffff"
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="sans-serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fill: '#ffffff' }}
                  >
                    {cell.value}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}

      {/* Memory area plots - rendered above each GPU row with curves */}
      {gridData.map((_, gpuIdx) => {
        const rowY = headerHeight + headerRowGap + gpuIdx * (rowHeight + rowSpacing)
        const maxMemory = Math.max(...memoryUsage[gpuIdx], 1)
        
        if (maxMemory === 0) return null
        
        // Position area plot above the row
        // Use a fixed height for the area plot (20px) positioned just above the row
        const areaHeight = 20
        const areaBottom = rowY - 2 // Bottom of area plot (2px above row)
        
        // Build path for area chart with smooth curves
        const pathSegments: string[] = []
        
        // Start at bottom-left
        const firstMemory = memoryUsage[gpuIdx][0]
        const firstMemoryY = areaBottom - (firstMemory / maxMemory) * areaHeight
        pathSegments.push(`M ${startX} ${areaBottom}`)
        pathSegments.push(`L ${startX} ${firstMemoryY}`)
        
        // For each timestep, draw with smooth curves at cell boundaries
        for (let timeIdx = 0; timeIdx < numTimesteps; timeIdx++) {
          const memory = memoryUsage[gpuIdx][timeIdx]
          const cellEndX = startX + (timeIdx + 1) * cellWidth
          const memoryY = areaBottom - (memory / maxMemory) * areaHeight
          
          if (timeIdx < numTimesteps - 1) {
            const nextMemory = memoryUsage[gpuIdx][timeIdx + 1]
            const nextMemoryY = areaBottom - (nextMemory / maxMemory) * areaHeight
            
            // Draw horizontal line most of the way across the cell
            const curveStartX = cellEndX - cellWidth * 0.15 // Start curve 15% before cell end
            pathSegments.push(`L ${curveStartX} ${memoryY}`)
            
            // Use cubic bezier for smooth S-curve transition
            // Control points create a smooth transition
            const control1X = cellEndX - cellWidth * 0.05
            const control1Y = memoryY
            const control2X = cellEndX + cellWidth * 0.05
            const control2Y = nextMemoryY
            
            pathSegments.push(`C ${control1X} ${control1Y} ${control2X} ${control2Y} ${cellEndX + cellWidth * 0.15} ${nextMemoryY}`)
          } else {
            // Last cell - draw to end
            pathSegments.push(`L ${cellEndX} ${memoryY}`)
          }
        }
        
        // Close the path by going to bottom-right
        pathSegments.push(`L ${startX + numTimesteps * cellWidth} ${areaBottom}`)
        pathSegments.push('Z')
        
        return (
          <path
            key={`memory-area-${gpuIdx}`}
            d={pathSegments.join(' ')}
            fill="rgba(128, 128, 128, 0.3)"
            stroke="rgba(128, 128, 128, 0.5)"
            strokeWidth="1"
          />
        )
      })}
    </svg>
  )
}

function App() {
  const [numGPUs, setNumGPUs] = useState(4)
  const [numTimesteps, setNumTimesteps] = useState(10)
  const [passType, setPassType] = useState<PassType>('forward')
  const [gridData, setGridData] = useState<GridData>(() => 
    createDefaultGrid(4, 10)
  )

  const handleGridSizeChange = useCallback((newGPUs: number, newTimesteps: number) => {
    const newGrid: GridData = Array(newGPUs).fill(null).map((_, gpuIdx) => {
      if (gpuIdx < gridData.length) {
        // Preserve existing row data, extend or truncate as needed
        const existingRow = gridData[gpuIdx]
        return Array(newTimesteps).fill(null).map((_, timeIdx) => 
          timeIdx < existingRow.length ? existingRow[timeIdx] : {
            value: null,
            passType: null
          }
        )
      } else {
        // New row - create empty cells
        return Array(newTimesteps).fill(null).map(() => ({
          value: null,
          passType: null
        }))
      }
    })
    setGridData(newGrid)
  }, [gridData])

  const handleGPUsChange = (value: number) => {
    const newValue = Math.max(1, Math.min(50, value))
    setNumGPUs(newValue)
    handleGridSizeChange(newValue, numTimesteps)
  }

  const handleTimestepsChange = (value: number) => {
    const newValue = Math.max(1, Math.min(100, value))
    setNumTimesteps(newValue)
    handleGridSizeChange(numGPUs, newValue)
  }

  const handleCellChange = (gpuIdx: number, timeIdx: number, value: string) => {
    const newGrid = gridData.map((row, r) => 
      r === gpuIdx 
        ? row.map((cell, c) => {
            if (c === timeIdx) {
              const numValue = value === '' ? null : (isNaN(Number(value)) ? null : Number(value))
              return {
                value: numValue,
                passType: numValue !== null ? passType : null
              }
            }
            return cell
          })
        : row
    )
    setGridData(newGrid)
  }

  const blankCount = useMemo(() => {
    return calculateBlankCount(gridData)
  }, [gridData])

  const svgRef = useRef<SVGSVGElement>(null)

  const handleDownloadSVG = useCallback(() => {
    if (!svgRef.current) return

    const svgElement = svgRef.current.cloneNode(true) as SVGSVGElement
    
    // Ensure SVG has proper namespace and attributes
    if (!svgElement.getAttribute('xmlns')) {
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }
    if (!svgElement.getAttribute('xmlns:xlink')) {
      svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    }
    
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    
    const downloadLink = document.createElement('a')
    downloadLink.href = svgUrl
    downloadLink.download = 'gpu-visualization.svg'
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    
    URL.revokeObjectURL(svgUrl)
  }, [])

  return (
    <div className="App">
      <h1>GPU Pipelining Visualization</h1>
      
      <div className="main-layout">
        <div className="top-section">
          <div className="input-controls">
            <div className="control-group">
              <label htmlFor="num-gpus">Number of GPUs:</label>
              <input
                id="num-gpus"
                type="number"
                min="1"
                max="50"
                value={numGPUs}
                onChange={(e) => handleGPUsChange(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="control-group">
              <label htmlFor="num-timesteps">Number of Timesteps:</label>
              <input
                id="num-timesteps"
                type="number"
                min="1"
                max="100"
                value={numTimesteps}
                onChange={(e) => handleTimestepsChange(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="control-group">
              <label>Pass Type:</label>
              <div className="toggle-switch-container">
                <span className={`toggle-label ${passType === 'forward' ? 'active' : ''}`}>Forward</span>
                <button
                  type="button"
                  className={`toggle-switch ${passType === 'backward' ? 'backward' : 'forward'}`}
                  onClick={() => setPassType(passType === 'forward' ? 'backward' : 'forward')}
                  aria-label="Toggle pass type"
                >
                  <span className="toggle-slider"></span>
                </button>
                <span className={`toggle-label ${passType === 'backward' ? 'active' : ''}`}>Backward</span>
              </div>
            </div>
          </div>

          <div className="grid-container">
            <div className="grid-wrapper">
              <div className="grid-header">
                <div className="corner-cell"></div>
                {Array(numTimesteps).fill(0).map((_, idx) => (
                  <div key={idx} className="header-cell">t{idx}</div>
                ))}
              </div>
              <div className="grid-body">
                {gridData.map((row, gpuIdx) => (
                  <div key={gpuIdx} className="grid-row">
                    <div className="row-label">GPU {gpuIdx}</div>
                    {row.map((cell, timeIdx) => (
                      <input
                        key={timeIdx}
                        type="text"
                        className={`grid-cell ${cell.value !== null ? 'filled' : 'empty'} ${cell.passType ? `pass-${cell.passType}` : ''}`}
                        value={cell.value === null ? '' : cell.value}
                        style={{ 
                          backgroundColor: cell.value !== null 
                            ? (cell.passType === 'forward' ? '#ff8800' : '#646cff') 
                            : undefined,
                          borderColor: cell.value !== null ? 'rgba(255,255,255,0.2)' : undefined
                        }}
                        onChange={(e) => handleCellChange(gpuIdx, timeIdx, e.target.value)}
                        placeholder="-"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="bottom-section">
          <div className="flow-container">
            <FlowVisualization gridData={gridData} numGPUs={numGPUs} numTimesteps={numTimesteps} svgRef={svgRef} />
            <div className="bottom-controls">
              <div className="control-group">
                <label>Bubble count:</label>
                <div className="blank-counter">{blankCount}</div>
              </div>
              <div className="control-group">
                <button 
                  className="download-button"
                  onClick={handleDownloadSVG}
                  type="button"
                >
                  Download as SVG
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

