import { useState, useCallback, useMemo } from 'react'
import './App.css'

type CellData = {
  value: number | null
  passType: PassType | null
}

type GridData = CellData[][]

type PassType = 'forward' | 'backward'

function App() {
  const [numGPUs, setNumGPUs] = useState(4)
  const [numTimesteps, setNumTimesteps] = useState(10)
  const [passType, setPassType] = useState<PassType>('forward')
  const [gridData, setGridData] = useState<GridData>(() => 
    Array(numGPUs).fill(null).map(() => Array(numTimesteps).fill(null).map(() => ({
      value: null,
      passType: null
    })))
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
        // New row
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
    return gridData.reduce((count, row) => 
      count + row.filter(cell => cell.value === null).length, 0
    )
  }, [gridData])

  return (
    <div className="App">
      <header className="App-header">
        <h1>GPU Pipelining Visualization</h1>
        
        <div className="controls">
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
            <label>Bubble size:</label>
            <div className="blank-counter">{blankCount}</div>
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
                      onChange={(e) => handleCellChange(gpuIdx, timeIdx, e.target.value)}
                      placeholder="-"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}

export default App

