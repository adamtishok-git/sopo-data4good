const WALK_THRESHOLD = 1609.34; // 1 mile in meters

export function computeMetrics(blocks, assignments, openSchools, schools) {
  const metrics = {};

  for (const sid of openSchools) {
    const zoneBlocks = blocks.filter(b => assignments[b.id] === sid);

    const assignedStudents = zoneBlocks.reduce((s, b) => s + b.students, 0);
    const capacity = schools[sid].capacity;

    const walkableBlocks    = zoneBlocks.filter(b => b.walkDists[sid] !== null && b.walkDists[sid] <= WALK_THRESHOLD);
    const nonWalkableBlocks = zoneBlocks.filter(b => b.walkDists[sid] === null  || b.walkDists[sid] >  WALK_THRESHOLD);

    const walkableStudents = walkableBlocks.reduce((s, b) => s + b.students, 0);
    const pctWalkable = assignedStudents > 0 ? (walkableStudents / assignedStudents) * 100 : 0;

    // Population-weighted avg drive for non-walkable blocks
    let avgDriveNonWalkableMi = null;
    const totalNwPop = nonWalkableBlocks.reduce((s, b) => s + b.population, 0);
    if (totalNwPop > 0) {
      const weighted = nonWalkableBlocks.reduce((s, b) => {
        const dd = b.driveDists[sid];
        return dd !== null ? s + dd * b.population : s;
      }, 0);
      avgDriveNonWalkableMi = weighted / totalNwPop / 1609.34;
    }

    metrics[sid] = {
      assignedStudents: Math.round(assignedStudents * 10) / 10,
      capacity,
      utilization: capacity > 0 ? assignedStudents / capacity : 0,
      pctWalkable: Math.round(pctWalkable * 10) / 10,
      avgDriveNonWalkableMi: avgDriveNonWalkableMi !== null
        ? Math.round(avgDriveNonWalkableMi * 100) / 100
        : null,
      overCapacity: assignedStudents > capacity,
    };
  }

  return metrics;
}
