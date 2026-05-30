import type { Feature, FeatureCollection, Geometry } from 'geojson';

/** Properties we attach to each city/area polygon feature. */
export interface CityFeatureProperties {
  /** Canonical Hebrew area/city name as delivered by Oref. */
  name: string;
  /** Optional English label. */
  nameEn?: string;
  /** Optional centroid [lng, lat] used to fly the camera. */
  center?: [number, number];
}

export type CityFeature = Feature<Geometry, CityFeatureProperties>;
export type CityFeatureCollection = FeatureCollection<Geometry, CityFeatureProperties>;
