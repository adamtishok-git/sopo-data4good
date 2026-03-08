import { useState } from 'react'
import MapView   from './MapView'
import StatsPanel from './StatsPanel'

export default function ScenarioView({ scenarioData, state, active, onReassign, onReset }) {
  const [selectedBlock, setSelectedBlock] = useState(null);

  return (
    <div className={`scenario-view${active ? '' : ' hidden'}`}>
      <div className="map-container">
        {active && (
          <MapView
            scenarioData={scenarioData}
            assignments={state.assignments}
            editedBlocks={state.editedBlocks}
            selectedBlockId={selectedBlock?.id ?? null}
            onBlockClick={setSelectedBlock}
          />
        )}
      </div>
      <div className="sidebar">
        <StatsPanel
          scenarioData={scenarioData}
          assignments={state.assignments}
          editedBlocks={state.editedBlocks}
          selectedBlock={selectedBlock}
          onReassign={onReassign}
          onReset={() => { setSelectedBlock(null); onReset(); }}
        />
      </div>
    </div>
  );
}
