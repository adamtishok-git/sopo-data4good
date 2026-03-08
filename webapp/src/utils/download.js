const WALK_THRESHOLD = 1609.34;

export function downloadGeoJSON(scenarioData, assignments, editedBlocks, scenarioKey) {
  const features = scenarioData.blocks.map(block => {
    const assignedSchool = assignments[block.id];
    const walkDist  = block.walkDists[assignedSchool];
    const driveDist = block.driveDists[assignedSchool];
    const walkable  = walkDist !== null && walkDist <= WALK_THRESHOLD;

    return {
      type: 'Feature',
      geometry: block.geometry,
      properties: {
        block_id:        block.id,
        assigned_school: assignedSchool,
        base_assignment: block.baseAssignment,
        was_edited:      editedBlocks.has(block.id),
        population:      block.population,
        students:        block.students,
        walk_dist_m:     walkDist,
        walk_dist_mi:    walkDist  !== null ? Math.round(walkDist  / 1609.34 * 100) / 100 : null,
        drive_dist_m:    driveDist,
        drive_dist_mi:   driveDist !== null ? Math.round(driveDist / 1609.34 * 100) / 100 : null,
        walkable,
      },
    };
  });

  const geojson = { type: 'FeatureCollection', features };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${scenarioKey}_zones.geojson`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
