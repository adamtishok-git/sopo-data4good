import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import { computeMetrics } from '../utils/metrics.js'

const WALK_THRESHOLD = 1609.34;
const MAP_CENTER     = [43.632, -70.270];
const MAP_ZOOM       = 13;

function getModeStudentKey(modeKey) {
  if (!modeKey) return 'studentsK4';
  if (modeKey.startsWith('prek1')) return 'studentsK1';
  if (modeKey === 'g24')           return 'studentsG24';
  return 'studentsK4';
}

function parseGeoJSON(geojson) {
  const { metadata, features } = geojson;
  const { openSchools, schools, modeKey, prekAllocations } = metadata;

  const blocks = features.map(f => ({
    id:             f.properties.block_id,
    geometry:       f.geometry,
    population:     f.properties.population,
    studentsK4:     f.properties.students_k4,
    studentsK1:     f.properties.students_k1,
    studentsG24:    f.properties.students_g24,
    walkDists:      f.properties.all_walk_dists  || {},
    driveDists:     f.properties.all_drive_dists || {},
    baseAssignment: f.properties.assigned_school,
  }));

  const initAssignments = {};
  features.forEach(f => { initAssignments[f.properties.block_id] = f.properties.assigned_school; });

  const studentKey = getModeStudentKey(modeKey);
  return { blocks, openSchools, schools, modeKey, studentKey,
           prekAllocations: prekAllocations || {}, initAssignments, metadata };
}

function blockStyle(color, isSelected) {
  return { fillColor: color, fillOpacity: 0.65, color: '#555', weight: isSelected ? 2.5 : 0.6 };
}

function UploadMap({ parsed, assignments, selectedBlockId, onBlockClick }) {
  const mapElRef  = useRef(null);
  const mapRef    = useRef(null);
  const layersRef = useRef({});
  const cbRef     = useRef(onBlockClick);
  const asgnRef   = useRef(assignments);

  useEffect(() => { cbRef.current  = onBlockClick;  });
  useEffect(() => { asgnRef.current = assignments; });

  useEffect(() => {
    const { blocks, schools, openSchools, studentKey } = parsed;
    const map = L.map(mapElRef.current, { center: MAP_CENTER, zoom: MAP_ZOOM });
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19,
    }).addTo(map);

    blocks.forEach(block => {
      const sid   = assignments[block.id];
      const color = sid && schools[sid] ? schools[sid].color : '#ccc';
      const layer = L.geoJSON(block.geometry, { style: blockStyle(color, false) });

      layer.on('click', () => cbRef.current(block));
      layer.on('mouseover', e => {
        const curSid = asgnRef.current[block.id];
        const wd  = curSid ? (block.walkDists[curSid]  ?? null) : null;
        const dd  = curSid ? (block.driveDists[curSid] ?? null) : null;
        const fmt = m => m !== null ? (m / 1609.34).toFixed(2) + ' mi' : 'N/A';
        const stud = (block[studentKey] || 0).toFixed(1);
        layer.bindTooltip(
          `<b>${block.id}</b><br>Pop: ${block.population} · Students: ${stud}<br>` +
          `Assigned: ${curSid || '—'}<br>Walk: ${fmt(wd)} · Drive: ${fmt(dd)}`,
          { sticky: true }
        ).openTooltip(e.latlng);
      });
      layer.on('mouseout', () => layer.unbindTooltip());

      layer.addTo(map);
      layersRef.current[block.id] = layer;
    });

    openSchools.forEach(sid => {
      const s = schools[sid];
      if (!s) return;
      L.circle([s.lat, s.lng], {
        radius: WALK_THRESHOLD, color: s.color, weight: 1.5, dashArray: '6', fill: false,
      }).addTo(map);
      L.circleMarker([s.lat, s.lng], {
        radius: 9, color: '#fff', weight: 2, fillColor: s.color, fillOpacity: 1,
      }).bindTooltip(sid).addTo(map);
    });

    return () => { map.remove(); mapRef.current = null; layersRef.current = {}; };
  }, []); // eslint-disable-line

  useEffect(() => {
    const { blocks, schools } = parsed;
    blocks.forEach(block => {
      const layer = layersRef.current[block.id];
      if (!layer) return;
      const sid   = assignments[block.id];
      const color = sid && schools[sid] ? schools[sid].color : '#ccc';
      layer.setStyle(blockStyle(color, block.id === selectedBlockId));
      if (block.id === selectedBlockId) layer.bringToFront();
    });
  }, [assignments, selectedBlockId]); // eslint-disable-line

  return <div ref={mapElRef} className="map-el" />;
}

function fmtMi(m) {
  return m !== null && m !== undefined ? (m / 1609.34).toFixed(2) + ' mi' : 'N/A';
}

function UploadStatsPanel({ parsed, assignments, selectedBlock, onReassign, onClear }) {
  const { openSchools, schools, studentKey, prekAllocations, modeKey, metadata } = parsed;
  const metrics = computeMetrics(parsed.blocks, assignments, openSchools, schools, studentKey, prekAllocations);

  const assignedSchool = selectedBlock ? assignments[selectedBlock.id] : null;
  const walkDist  = selectedBlock && assignedSchool ? (selectedBlock.walkDists[assignedSchool]  ?? null) : null;
  const driveDist = selectedBlock && assignedSchool ? (selectedBlock.driveDists[assignedSchool] ?? null) : null;
  const isWalkable   = walkDist !== null && walkDist <= WALK_THRESHOLD;
  const studentCount = selectedBlock ? (selectedBlock[studentKey] || 0) : 0;

  const scenarioLabel = metadata.scenario
    ? metadata.scenario.replace(/_closed$/, ' Closed').replace(/_/g, ' ')
    : 'Uploaded';

  return (
    <>
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-section-title">{scenarioLabel}</div>
          <div className="school-stat" style={{ marginBottom: 4 }}>
            Mode: <strong>{modeKey}</strong>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">School Enrollment</div>
          {openSchools.map(sid => {
            const m = metrics[sid];
            if (!m) return null;
            const pct    = Math.min(m.utilization * 100, 100);
            const isOver = m.overCapacity;
            return (
              <div className="school-card" key={sid}>
                <div className="school-card-header">
                  <span className="school-dot" style={{ background: schools[sid]?.color }} />
                  <span className="school-name">{sid}</span>
                  {isOver && <span className="over-badge">OVER</span>}
                </div>
                <div className="util-bar-bg">
                  <div className="util-bar-fill"
                    style={{ width: pct + '%', background: isOver ? '#e74c3c' : schools[sid]?.color }} />
                </div>
                <div className={`school-stat${isOver ? ' stat-over' : ''}`}>
                  {m.totalEnrolled.toFixed(0)} / {m.capacity} enrolled
                  {m.prekCount > 0 && <span className="prek-note"> (incl. {m.prekCount} PreK)</span>}
                </div>
                <div className="school-stat">
                  {m.pctWithin1Mile.toFixed(0)}% within 1 mi
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
          <div className="block-panel-title">Selected Block</div>
          <div className="block-stat-row">Block: <span title={selectedBlock.id}>{selectedBlock.id.slice(-9)}</span></div>
          <div className="block-stat-row">Population: <span>{selectedBlock.population}</span></div>
          <div className="block-stat-row">Est. students: <span>{studentCount.toFixed(1)}</span></div>
          {assignedSchool && (
            <>
              <div className="block-stat-row">
                Walk to {assignedSchool}: <span>{fmtMi(walkDist)}</span> {isWalkable ? 'Walk' : 'Drive'}
              </div>
              <div className="block-stat-row">Drive to {assignedSchool}: <span>{fmtMi(driveDist)}</span></div>
            </>
          )}
          <div className="reassign-label">Assign to:</div>
          <select
            className="reassign-select"
            value={assignedSchool || ''}
            onChange={e => onReassign(selectedBlock.id, e.target.value)}
          >
            {openSchools.map(sid => (
              <option key={sid} value={sid}>
                {sid}{sid === selectedBlock.baseAssignment ? ' (original)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="sidebar-actions">
        <button className="btn btn-secondary" onClick={onClear}>Clear Upload</button>
      </div>
    </>
  );
}

export default function UploadTab({ active }) {
  const [parsed,        setParsed]        = useState(null);
  const [assignments,   setAssignments]   = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [dragOver,      setDragOver]      = useState(false);
  const [error,         setError]         = useState(null);

  function handleFile(file) {
    setError(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const geojson = JSON.parse(e.target.result);
        if (geojson.metadata?.source !== 'sopo-redistricting-tool') {
          setError('This file was not exported from the South Portland redistricting tool.');
          return;
        }
        if (!geojson.features?.length) {
          setError('No features found in this file.');
          return;
        }
        const p = parseGeoJSON(geojson);
        setParsed(p);
        setAssignments({ ...p.initAssignments });
        setSelectedBlock(null);
      } catch {
        setError('Could not parse file. Please upload a valid GeoJSON file.');
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleClear() {
    setParsed(null);
    setAssignments(null);
    setSelectedBlock(null);
    setError(null);
  }

  function handleReassign(blockId, newSchool) {
    setAssignments(prev => ({ ...prev, [blockId]: newSchool }));
  }

  if (!active) return <div className="scenario-view hidden" />;

  if (!parsed) {
    return (
      <div className="scenario-view upload-view">
        <div
          className={`upload-drop-area${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="upload-icon">&#128193;</div>
          <div className="upload-title">Drop a zone file here</div>
          <div className="upload-subtitle">
            Upload a GeoJSON file exported from this tool to visualize and compare shared zone plans.
          </div>
          <label className="btn btn-secondary upload-browse">
            Browse file
            <input
              type="file" accept=".geojson,.json"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
            />
          </label>
          {error && <div className="upload-error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="scenario-view">
      <div className="map-container">
        <UploadMap
          parsed={parsed}
          assignments={assignments}
          selectedBlockId={selectedBlock?.id ?? null}
          onBlockClick={setSelectedBlock}
        />
      </div>
      <div className="sidebar">
        <UploadStatsPanel
          parsed={parsed}
          assignments={assignments}
          selectedBlock={selectedBlock}
          onReassign={handleReassign}
          onClear={handleClear}
        />
      </div>
    </div>
  );
}
