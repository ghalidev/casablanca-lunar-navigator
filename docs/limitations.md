# Known limitations

- No thermal model: a lander "dies" only when the battery reaches 0 (cold is not simulated). Athena's loss also involved cold.
- Terrain resolution limits horizon accuracy for nearby obstacles (DEM resolution TBD).
- (add every limitation as soon as it is known)
- Site positions are one digitized point per Artemis III region (±~3 km), not NASA's actual landing sites inside each region, which are not public. Lighting changes over a few km near the pole.
- Terrain horizons come from a global LOLA grid (see horizonSource in sites.json for the resolution), not the 5–20 m polar LOLA products: obstacles smaller than a few DEM pixels (boulders, small craters, the local slope under the lander) are not resolved.
- Each site is one point (the region's highest LOLA point). Lighting differs elsewhere inside the same region.
- Terrain sunlight percentages are good to about ±10 points: compared with a published Kaguya-based study (Bussey et al. 2010) at 6 summits, the mean difference is 5.5 points and the worst is 13 (docs/validation.md).
