import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import MapView    from './MapView'
import StatsPanel from './StatsPanel'
import { downloadGeoJSON } from '../utils/download.js'
import { computeChangeRate } from '../utils/metrics.js'

const WALK_THRESHOLD = 1207.0;
const GRADE_LABELS   = { k: 'K', g1: '1st', g2: '2nd', g3: '3rd', g4: '4th' };

function BlockPopup({ block, assignments, editedBlocks, visibleSchools, schools,
                      studentKey, modeKey, pos, onReassign, onClose }) {
  const assignedSchool = assignments[block.id];
  const walkDist   = assignedSchool ? block.walkDists[assignedSchool] : null;
  const isWalkable = walkDist !== null && walkDist <= WALK_THRESHOLD;
  const isEdited   = editedBlocks.has(block.id);
  const students   = (block[studentKey] || 0).toFixed(1);
  const baseSchool = block.baseAssignments?.[modeKey];

  return (
    <div className="block-popup" style={{ left: pos.x, top: pos.y }}>
      <div className="block-popup-header">
        <span className="block-popup-id">···{block.id.slice(-6)}</span>
        {isEdited && <span className="edited-badge">edited</span>}
        <button className="block-popup-close" onClick={onClose}>✕</button>
      </div>
      <div className="block-popup-row">{students} est. students</div>
      <div className="block-popup-row">
        <span className={isWalkable ? 'tag-walkable' : 'tag-bussed'}>
          {isWalkable ? 'Walkable' : 'Bussed'}
        </span>
      </div>
      <select
        className="reassign-select"
        value={assignedSchool || ''}
        onChange={e => onReassign(block.id, e.target.value)}
      >
        {visibleSchools.map(sid => (
          <option key={sid} value={sid}>{sid}{sid === baseSchool ? ' (base)' : ''}</option>
        ))}
      </select>
    </div>
  );
}

function majoritySchool(dist) {
  const entries = Object.entries(dist || {}).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function ChangedBlocksPanel({ blocks, changedBlockIds, assignments, schools,
                               visibleSchools, studentKey, modeKey, gcMode,
                               gradeLevel, prek1Assignments, g24Assignments,
                               onReassign, onClose }) {
  const changedBlocks = blocks.filter(b => changedBlockIds.has(b.id));

  return (
    <div className="changed-panel">
      <div className="changed-panel-header">
        <span className="changed-panel-title">Changed Blocks ({changedBlocks.length})</span>
        <button className="changed-panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="changed-panel-body">
        <table className="changed-panel-table">
          <thead>
            <tr>
              <th>Block</th>
              <th>Students</th>
              <th>Mode</th>
              <th>Original</th>
              <th>New School</th>
            </tr>
          </thead>
          <tbody>
            {changedBlocks.map(block => {
              const sid       = assignments[block.id];
              const wd        = sid ? block.walkDists[sid] : null;
              const walkable  = wd !== null && wd <= WALK_THRESHOLD;
              const students  = (block[studentKey] || 0).toFixed(1);
              const origDist  = gcMode
                ? (gradeLevel === 'g24' ? block.currentSchoolsG24 : block.currentSchoolsK1)
                : block.currentSchoolsK4;
              const origSchool = majoritySchool(origDist) || '—';
              const curAssign  = gcMode
                ? (gradeLevel === 'g24' ? g24Assignments?.[block.id] : prek1Assignments?.[block.id])
                : sid;

              return (
                <tr key={block.id}>
                  <td className="block-id-cell" title={block.id}>···{block.id.slice(-8)}</td>
                  <td>{students}</td>
                  <td>
                    <span className={walkable ? 'tag-walkable' : 'tag-bussed'} style={{ fontSize: 10, padding: '1px 6px' }}>
                      {walkable ? 'Walk' : 'Bus'}
                    </span>
                  </td>
                  <td className="school-orig">{origSchool}</td>
                  <td>
                    <select
                      className="changed-panel-select"
                      value={curAssign || ''}
                      onChange={e => onReassign(block.id, e.target.value)}
                    >
                      {visibleSchools.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ScenarioView({
  scenarioData, states, active,
  modeKey, modeOption, studentKey, visibleSchools,
  gcMode, gradeLevel, onGradeLevelChange,
  onReassign, onReset,
}) {
  const [selectedBlock,    setSelectedBlock]    = useState(null);
  const [popupPos,         setPopupPos]         = useState(null);
  const [showChangedBlocks, setShowChangedBlocks] = useState(false);
  const viewRef = useRef(null);

  const state      = states[modeKey];
  const prek1State = gcMode ? (states[modeOption] || { assignments: {} }) : null;
  const g24State   = gcMode ? (states['g24']      || { assignments: {} }) : null;

  // % change calculation
  const changeInfo = computeChangeRate(
    scenarioData.blocks,
    gcMode,
    state.assignments,
    prek1State?.assignments,
    g24State?.assignments,
  );

  // Block IDs where students change schools (for highlight overlay)
  const changedBlockIds = showChangedBlocks ? (() => {
    const ids = new Set();
    for (const block of scenarioData.blocks) {
      if (!gcMode) {
        const sid   = state.assignments[block.id];
        const cs    = block.currentSchoolsK4 || {};
        const total = Object.values(cs).reduce((s, v) => s + v, 0);
        if (total > 0 && (cs[sid] || 0) < total) ids.add(block.id);
      } else {
        const prek1School = prek1State?.assignments[block.id];
        const g24School   = g24State?.assignments[block.id];
        const csK1  = block.currentSchoolsK1  || {};
        const csG24 = block.currentSchoolsG24 || {};
        const totalK1  = Object.values(csK1).reduce((s, v) => s + v, 0);
        const totalG24 = Object.values(csG24).reduce((s, v) => s + v, 0);
        if ((totalK1  > 0 && (csK1[prek1School]  || 0) < totalK1) ||
            (totalG24 > 0 && (csG24[g24School]   || 0) < totalG24))
          ids.add(block.id);
      }
    }
    return ids;
  })() : null;

  function handleBlockClick(block, pos) {
    setSelectedBlock(block);
    setPopupPos(pos || null);
  }

  function handleReassign(blockId, newSchool) {
    onReassign(modeKey, blockId, newSchool);
  }

  function handleReset() {
    setSelectedBlock(null);
    onReset(modeKey);
  }

  function handleDownloadGeoJSON() {
    const prekAllocations = scenarioData.prekAllocations[modeKey] || {};
    if (gcMode) {
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

  return (
    <div ref={viewRef} className={`scenario-view${active ? '' : ' hidden'}`}>
      <div className="map-container">
        {active && (
          <MapView
            scenarioData={scenarioData}
            assignments={state.assignments}
            editedBlocks={state.editedBlocks}
            selectedBlockId={selectedBlock?.id ?? null}
            onBlockClick={handleBlockClick}
            visibleSchools={visibleSchools}
            studentKey={studentKey}
            changedBlockIds={changedBlockIds}
          />
        )}
        {selectedBlock && popupPos && (
          <BlockPopup
            block={selectedBlock}
            assignments={state.assignments}
            editedBlocks={state.editedBlocks}
            visibleSchools={visibleSchools}
            schools={scenarioData.schools}
            studentKey={studentKey}
            modeKey={modeKey}
            pos={popupPos}
            onReassign={handleReassign}
            onClose={() => setSelectedBlock(null)}
          />
        )}
        {/* Grade-band overlay — floats top-center over map */}
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
        {/* Changed blocks panel — floats bottom-left over map */}
        {showChangedBlocks && changedBlockIds && (
          <ChangedBlocksPanel
            blocks={scenarioData.blocks}
            changedBlockIds={changedBlockIds}
            assignments={state.assignments}
            schools={scenarioData.schools}
            visibleSchools={visibleSchools}
            studentKey={studentKey}
            modeKey={modeKey}
            gcMode={gcMode}
            gradeLevel={gradeLevel}
            prek1Assignments={prek1State?.assignments}
            g24Assignments={g24State?.assignments}
            onReassign={handleReassign}
            onClose={() => setShowChangedBlocks(false)}
          />
        )}
        {/* % change overlay — floats top-right over map */}
        <div className="change-overlay">
          <button
            className={`change-pill${showChangedBlocks ? ' active' : ''}`}
            onClick={() => setShowChangedBlocks(v => !v)}
            title={showChangedBlocks ? 'Click to clear highlight' : 'Click to highlight changed blocks'}
          >
            {changeInfo.pctChange}% Change Schools
            <svg xmlns="http://www.w3.org/2000/svg" height="12" width="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="sidebar">
        <StatsPanel
          scenarioData={scenarioData}
          assignments={state.assignments}
          editedBlocks={state.editedBlocks}
          onReset={handleReset}
          modeKey={modeKey}
          studentKey={studentKey}
          visibleSchools={visibleSchools}
        />
        <div className="sidebar-actions sidebar-export-row">
          <button className="btn btn-secondary btn-export" onClick={handleDownloadGeoJSON}>
            <svg xmlns="http://www.w3.org/2000/svg" height="13" width="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            GeoJSON
          </button>
          <button className="btn btn-secondary btn-export" onClick={handleExportPNG}>
            <svg xmlns="http://www.w3.org/2000/svg" height="13" width="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            PNG
          </button>
        </div>
      </div>
    </div>
  );
}
