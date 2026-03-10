import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import MapView    from './MapView'
import StatsPanel from './StatsPanel'
import { downloadGeoJSON } from '../utils/download.js'

export default function ScenarioView({
  scenarioData, states, active,
  modeKey, modeOption, studentKey, visibleSchools,
  gcMode, gradeLevel, onGradeLevelChange,
  onReassign, onReset,
}) {
  const [selectedBlock, setSelectedBlock] = useState(null);
  const viewRef = useRef(null);

  const state = states[modeKey];

  function handleReassign(blockId, newSchool) {
    onReassign(modeKey, blockId, newSchool);
  }

  function handleReset() {
    setSelectedBlock(null);
    onReset(modeKey);
  }

  function handleExportPNG() {
    if (!viewRef.current) return;
    const scenario = scenarioData.scenario || 'zones';
    html2canvas(viewRef.current, { useCORS: true, scale: 2 }).then(canvas => {
      const link = document.createElement('a');
      link.download = `${scenario}_${modeKey}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  function handleDownload() {
    const prekAllocations = scenarioData.prekAllocations[modeKey] || {};
    if (gcMode) {
      const prek1State = states[modeOption] || { assignments: {}, editedBlocks: new Set() };
      const g24State   = states['g24']      || { assignments: {}, editedBlocks: new Set() };
      downloadGeoJSON({
        scenarioData,
        isGradeCenter:     true,
        modeOption,
        modeKey,
        studentKey,
        prekAllocations,
        assignments:       state.assignments,
        editedBlocks:      state.editedBlocks,
        prek1Assignments:  prek1State.assignments,
        g24Assignments:    g24State.assignments,
        prek1EditedBlocks: prek1State.editedBlocks,
        g24EditedBlocks:   g24State.editedBlocks,
      });
    } else {
      downloadGeoJSON({
        scenarioData,
        isGradeCenter: false,
        modeKey,
        studentKey,
        prekAllocations,
        assignments:   state.assignments,
        editedBlocks:  state.editedBlocks,
      });
    }
  }

  return (
    <div ref={viewRef} className={`scenario-view${active ? '' : ' hidden'}`}>
      <div className="map-container">
        {active && (
          <MapView
            scenarioData={scenarioData}
            assignments={state.assignments}
            editedBlocks={state.editedBlocks}
            selectedBlockId={selectedBlock?.id ?? null}
            onBlockClick={setSelectedBlock}
            visibleSchools={visibleSchools}
            studentKey={studentKey}
          />
        )}
        {/* Grade-band overlay — floats over map, only in grade-center mode */}
        {gcMode && (
          <div className="grade-band-overlay">
            <button
              className={`band-btn${gradeLevel === 'prek1' ? ' active' : ''}`}
              onClick={() => { onGradeLevelChange('prek1'); setSelectedBlock(null); }}
            >PreK–1</button>
            <button
              className={`band-btn${gradeLevel === 'g24' ? ' active' : ''}`}
              onClick={() => { onGradeLevelChange('g24'); setSelectedBlock(null); }}
            >2–4</button>
          </div>
        )}
      </div>

      <div className="sidebar">
        <StatsPanel
          scenarioData={scenarioData}
          assignments={state.assignments}
          editedBlocks={state.editedBlocks}
          selectedBlock={selectedBlock}
          onReassign={handleReassign}
          onReset={handleReset}
          onDownload={handleDownload}
          onExportPNG={handleExportPNG}
          modeKey={modeKey}
          studentKey={studentKey}
          visibleSchools={visibleSchools}
        />
      </div>
    </div>
  );
}
