const WALK_THRESHOLD = 1609.34;

export function downloadGeoJSON(scenarioData, assignments, editedBlocks, modeKey, studentKey, prekAllocations) {
  const { scenario, closedSchool, openSchools, schools } = scenarioData;

  const features = scenarioData.blocks.map(block => {
    const assignedSchool = assignments[block.id];
    const walkDist  = assignedSchool ? block.walkDists[assignedSchool]  : null;
    const driveDist = assignedSchool ? block.driveDists[assignedSchool] : null;
    const walkable  = walkDist !== null && walkDist <= WALK_THRESHOLD;

    // Embed all school distances so uploaded files are self-contained
    const allWalkDists  = {};
    const allDriveDists = {};
    for (const sid of openSchools) {
      allWalkDists[sid]  = block.walkDists[sid];
      allDriveDists[sid] = block.driveDists[sid];
    }

    return {
      type: 'Feature',
      geometry: block.geometry,
      properties: {
        block_id:        block.id,
        assigned_school: assignedSchool,
        base_assignment: block.baseAssignments[modeKey],
        was_edited:      editedBlocks.has(block.id),
        population:      block.population,
        students_k4:     block.studentsK4,
        students_k1:     block.studentsK1,
        students_g24:    block.studentsG24,
        walk_dist_m:     walkDist,
        walk_dist_mi:    walkDist  !== null ? Math.round(walkDist  / 1609.34 * 100) / 100 : null,
        drive_dist_m:    driveDist,
        drive_dist_mi:   driveDist !== null ? Math.round(driveDist / 1609.34 * 100) / 100 : null,
        walkable,
        all_walk_dists:  allWalkDists,
        all_drive_dists: allDriveDists,
      },
    };
  });

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      scenario,
      closedSchool,
      openSchools,
      schools,
      modeKey,
      prekAllocations,
      exportedAt: new Date().toISOString(),
      source: 'sopo-redistricting-tool',
    },
    features,
  };

  const filename = `${scenario}_${modeKey}_zones.geojson`;
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
