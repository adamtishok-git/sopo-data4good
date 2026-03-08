import { computeMetrics } from '../utils/metrics.js'
import { downloadGeoJSON } from '../utils/download.js'

export default function StatsPanel({
  scenarioData,
  assignments,
  editedBlocks,
  selectedBlock,
  onReassign,
  onReset,
}) {
  const { openSchools, schools, scenario } = scenarioData;
  const metrics = computeMetrics(scenarioData.blocks, assignments, openSchools, schools);
  const hasEdits = editedBlocks.size > 0;

  const assignedSchool = selectedBlock ? assignments[selectedBlock.id] : null;
  const walkDist  = selectedBlock && assignedSchool ? selectedBlock.walkDists[assignedSchool]  : null;
  const driveDist = selectedBlock && assignedSchool ? selectedBlock.driveDists[assignedSchool] : null;
  const isWalkable = walkDist !== null && walkDist <= 1609.34;
  const isEdited = selectedBlock ? editedBlocks.has(selectedBlock.id) : false;

  function fmtMi(m) {
    if (m === null || m === undefined) return 'N/A';
    return (m / 1609.34).toFixed(2) + ' mi';
  }

  return (
    <>
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-section-title">School Enrollment</div>
          {openSchools.map(sid => {
            const m = metrics[sid];
            const pct = Math.min(m.utilization * 100, 100);
            const isOver = m.overCapacity;
            return (
              <div className="school-card" key={sid}>
                <div className="school-card-header">
                  <span className="school-dot" style={{ background: schools[sid].color }} />
                  <span className="school-name">{sid}</span>
                </div>
                <div className="util-bar-bg">
                  <div
                    className="util-bar-fill"
                    style={{ width: pct + '%', background: isOver ? '#e74c3c' : schools[sid].color }}
                  />
                </div>
                <div className="school-stat">
                  <span className={isOver ? 'stat-over' : ''}>
                    {m.assignedStudents} / {m.capacity} students
                    {isOver && <> — <span className="stat-over">OVER CAPACITY</span></>}
                  </span>
                </div>
                <div className="school-stat">
                  🚶 {m.pctWalkable.toFixed(0)}% walkable
                  &nbsp;·&nbsp;
                  🚗 {m.avgDriveNonWalkableMi !== null ? m.avgDriveNonWalkableMi.toFixed(2) + ' mi avg' : '—'}
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
          <div className="block-stat-row">Block: <span title={selectedBlock.id}>{selectedBlock.id.slice(-7)}</span></div>
          <div className="block-stat-row">Population: <span>{selectedBlock.population}</span></div>
          <div className="block-stat-row">Est. students: <span>{selectedBlock.students.toFixed(1)}</span></div>
          <div className="block-stat-row">
            Walk to {assignedSchool}: <span>{fmtMi(walkDist)}</span>
            {' '}{isWalkable ? '🚶' : '🚗'}
          </div>
          <div className="block-stat-row">Drive to {assignedSchool}: <span>{fmtMi(driveDist)}</span></div>
          <div className="reassign-label">Assign to:</div>
          <select
            className="reassign-select"
            value={assignedSchool || ''}
            onChange={e => onReassign(selectedBlock.id, e.target.value)}
          >
            {openSchools.map(sid => (
              <option key={sid} value={sid}>
                {sid}{sid === selectedBlock.baseAssignment ? ' (base)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="sidebar-actions">
        <button
          className="btn btn-primary"
          onClick={() => downloadGeoJSON(scenarioData, assignments, editedBlocks, scenario)}
        >
          ⬇ Download GeoJSON
        </button>
        <button
          className="btn btn-secondary"
          onClick={onReset}
          disabled={!hasEdits}
          style={{ opacity: hasEdits ? 1 : 0.45 }}
        >
          ↺ Reset to Base
        </button>
      </div>
    </>
  );
}
