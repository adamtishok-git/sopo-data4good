import { useEffect, useRef } from 'react'
import L from 'leaflet'

const MAP_CENTER   = [43.632, -70.270];
const MAP_ZOOM     = 13;
const WALK_RADIUS  = 1609.34;

function blockStyle(color, isEdited, isSelected) {
  return {
    fillColor:   color,
    fillOpacity: 0.65,
    color:       '#555',
    weight:      isSelected ? 2.5 : isEdited ? 2 : 0.6,
    dashArray:   isEdited && !isSelected ? '5,3' : null,
  };
}

export default function MapView({
  scenarioData, assignments, editedBlocks,
  selectedBlockId, onBlockClick, visibleSchools, studentKey,
}) {
  const mapElRef   = useRef(null);
  const mapRef     = useRef(null);
  const layersRef  = useRef({});
  const clickCbRef = useRef(onBlockClick);

  useEffect(() => { clickCbRef.current = onBlockClick; });

  // Initialize map once on mount
  useEffect(() => {
    const { schools, blocks } = scenarioData;

    const map = L.map(mapElRef.current, { center: MAP_CENTER, zoom: MAP_ZOOM });
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19,
    }).addTo(map);

    // Block polygons — use community_current as initial color source
    blocks.forEach(block => {
      const sid   = assignments[block.id];
      const color = sid && schools[sid] ? schools[sid].color : '#ccc';
      const layer = L.geoJSON(block.geometry, { style: blockStyle(color, false, false) });

      layer.on('click', () => clickCbRef.current(block));
      layer.on('mouseover', e => {
        const curSid = assignments[block.id];
        const wd  = curSid ? block.walkDists[curSid]  : null;
        const dd  = curSid ? block.driveDists[curSid] : null;
        const fmt = m => m !== null ? (m / 1609.34).toFixed(2) + ' mi' : 'N/A';
        const stud = (block[studentKey] || 0).toFixed(1);
        layer.bindTooltip(
          `<b>${block.id}</b><br>` +
          `Pop: ${block.population} · Students: ${stud}<br>` +
          `Assigned: ${curSid || '—'}<br>` +
          `Walk: ${fmt(wd)} · Drive: ${fmt(dd)}`,
          { sticky: true }
        ).openTooltip(e.latlng);
      });
      layer.on('mouseout', () => layer.unbindTooltip());

      layer.addTo(map);
      layersRef.current[block.id] = layer;
    });

    // School markers + walk circles — only for visible schools
    visibleSchools.forEach(sid => {
      const s = schools[sid];
      if (!s) return;
      L.circle([s.lat, s.lng], {
        radius: WALK_RADIUS, color: s.color, weight: 1.5, dashArray: '6', fill: false,
      }).addTo(map);
      L.circleMarker([s.lat, s.lng], {
        radius: 9, color: '#fff', weight: 2, fillColor: s.color, fillOpacity: 1,
      }).bindTooltip(`${sid}`, { permanent: false }).addTo(map);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layersRef.current = {}; };
  }, []); // eslint-disable-line

  // Update polygon styles when assignments / selection change
  useEffect(() => {
    const { schools } = scenarioData;
    scenarioData.blocks.forEach(block => {
      const layer = layersRef.current[block.id];
      if (!layer) return;
      const sid    = assignments[block.id];
      const color  = sid && schools[sid] ? schools[sid].color : '#ccc';
      const edited = editedBlocks.has(block.id);
      const sel    = block.id === selectedBlockId;
      layer.setStyle(blockStyle(color, edited, sel));
      if (sel) layer.bringToFront();
    });
  }, [assignments, editedBlocks, selectedBlockId]); // eslint-disable-line

  return <div ref={mapElRef} className="map-el" />;
}
