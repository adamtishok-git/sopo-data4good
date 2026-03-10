import { computeMetrics } from '../utils/metrics.js'

export default function StatsPanel({
  scenarioData, assignments, editedBlocks,
  selectedBlock, onReassign, onReset, onDownload,
  modeKey, studentKey, visibleSchools,
}) {
  const { schools } = scenarioData;
  const prekAllocations = scenarioData.prekAllocations[modeKey] || {};
  const metrics = computeMetrics(
    scenarioData.blocks, assignments, visibleSchools, schools, studentKey, prekAllocations
  );
  const hasEdits = editedBlocks.size > 0;

  const assignedSchool = selectedBlock ? assignments[selectedBlock.id] : null;
  const walkDist  = selectedBlock && assignedSchool ? selectedBlock.walkDists[assignedSchool]  : null;
  const driveDist = selectedBlock && assignedSchool ? selectedBlock.driveDists[assignedSchool] : null;
  const isWalkable   = walkDist !== null && walkDist <= 1609.34;
  const isEdited     = selectedBlock ? editedBlocks.has(selectedBlock.id) : false;
  const studentCount = selectedBlock ? (selectedBlock[studentKey] || 0) : 0;

  function fmtMi(m) {
    return m !== null && m !== undefined ? (m / 1609.34).toFixed(2) + ' mi' : 'N/A';
  }

  return (
    <>
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-section-title">School Enrollment</div>
          {visibleSchools.map(sid => {
            const m = metrics[sid];
            if (!m) return null;
            const pct    = Math.min(m.utilization * 100, 100);
            const isOver = m.overCapacity;
            return (
              <div className="school-card" key={sid}>
                <div className="school-card-header">
                  <span className="school-dot" style={{ background: schools[sid].color }} />
                  <span className="school-name">{sid}</span>
                  {isOver && <span className="over-badge">OVER</span>}
                </div>
                <div className="util-bar-bg">
                  <div className="util-bar-fill"
                    style={{ width: pct + '%', background: isOver ? '#e74c3c' : schools[sid].color }} />
                </div>
                <div className={`school-stat${isOver ? ' stat-over' : ''}`}>
                  {m.totalEnrolled.toFixed(0)} / {m.capacity} enrolled
                  {m.prekCount > 0 && <span className="prek-note"> (incl. {m.prekCount} PreK)</span>}
                </div>
                <div className="school-stat">
                  {m.pctWalkable.toFixed(0)}% walkable
                  <span className="stat-muted"> ({m.walkableStudents.toFixed(0)} students within 1 mi)</span>
                </div>
                <div className="school-stat">
                  {m.avgDriveNonWalkMi !== null ? m.avgDriveNonWalkMi.toFixed(2) + ' mi avg drive' : '—'}
                  {m.maxDriveMi !== null && <span className="stat-muted"> · max {m.maxDriveMi.toFixed(2)} mi</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedBlock && (
        <div className="block-panel">
          <div className="block-panel-title">
            Selected Block
            {isEdited && <span className="edited-badge">edited</span>}
          </div>
          <div className="block-stat-row">Block: <span title={selectedBlock.id}>{selectedBlock.id.slice(-9)}</span></div>
          <div className="block-stat-row">Population: <span>{selectedBlock.population}</span></div>
          <div className="block-stat-row">Est. students: <span>{studentCount.toFixed(1)}</span></div>
          {assignedSchool && <>
            <div className="block-stat-row">
              Walk to {assignedSchool}: <span>{fmtMi(walkDist)}</span>
              {' '}{isWalkable ? '(walkable)' : '(bussed)'}
            </div>
            <div className="block-stat-row">Drive to {assignedSchool}: <span>{fmtMi(driveDist)}</span></div>
          </>}
          <div className="reassign-label">Assign to:</div>
          <select
            className="reassign-select"
            value={assignedSchool || ''}
            onChange={e => onReassign(selectedBlock.id, e.target.value)}
          >
            {visibleSchools.map(sid => (
              <option key={sid} value={sid}>
                {sid}{sid === selectedBlock.baseAssignments?.[modeKey] ? ' (base)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="sidebar-actions">
        <button className="btn btn-primary" onClick={onDownload}>Download GeoJSON</button>
        <button className="btn btn-secondary" onClick={onReset}
          disabled={!hasEdits} style={{ opacity: hasEdits ? 1 : 0.45 }}>
          Reset to Base
        </button>
      </div>
    </>
  );
}
