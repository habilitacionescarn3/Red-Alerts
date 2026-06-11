import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Globe, Loader2, MapPin, Save, Search } from 'lucide-react';
import { isLocalhost } from '@/lib/env';
import { useLanguage } from '@/hooks/useLanguage';
import { ROUTES, pathTo } from '@/router/routes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GeoPreviewMap } from '@/components/map/GeoPreviewMap';
import { listAdminCities, saveCityCoordinates, searchLocations } from '@/api/services/geoAdminService';
import { MAP_COLORS } from '@/data/mapColors';
import type { AdminCity, GeoCandidate, PreviewCity } from '@/types/alerts';

/** Human label for a city's current geometry state. */
function geometryLabel(city: AdminCity | null): string {
  if (!city) return '';
  const points = city.coordinates;
  if (points === null) return 'unresolved (queued)';
  if (points.length === 0) return 'no match stored';
  if (points.length === 1) return 'marker (1 point)';
  return `area (${points.length} points)`;
}

/**
 * LOCAL-ONLY geocoding correction tool. Pick a city, search Nominatim for the
 * right place when the automatic top-hit was wrong, preview candidates on the
 * map, and save the chosen one. Gated to localhost (and the backend routes only
 * exist under GEO_ADMIN_ENABLED), so it never ships to the public site.
 */
export default function GeoAdminPage() {
  const { language } = useLanguage();

  const [cities, setCities] = useState<AdminCity[]>([]);
  const [cityFilter, setCityFilter] = useState('');
  const [selectedCity, setSelectedCity] = useState<AdminCity | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<GeoCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<GeoCandidate | null>(null);

  const [loadingCities, setLoadingCities] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!isLocalhost()) return;
    setLoadingCities(true);
    listAdminCities()
      .then(setCities)
      .catch(() => toast.error('Failed to load cities'))
      .finally(() => setLoadingCities(false));
  }, []);

  const filteredCities = useMemo(() => {
    const needle = cityFilter.trim();
    if (!needle) return cities;
    return cities.filter((c) => c.name.includes(needle));
  }, [cities, cityFilter]);

  // Every geocoded city as event-style geometry for the "show all" overlay.
  const allCities = useMemo<PreviewCity[]>(
    () =>
      cities
        .filter((c) => c.coordinates && c.coordinates.length > 0)
        .map((c) => ({ id: c.id, name: c.name, points: c.coordinates as PreviewCity['points'] })),
    [cities],
  );

  if (!isLocalhost()) {
    return <Navigate to={pathTo(ROUTES.HOME, language)} replace />;
  }

  function selectCity(city: AdminCity) {
    setSelectedCity(city);
    setSelectedCandidate(null);
    setCandidates([]);
    setSearchQuery(city.name);
  }

  async function runSearch() {
    const query = searchQuery.trim();
    if (!query) return;
    setSearching(true);
    setSelectedCandidate(null);
    try {
      const results = await searchLocations(query, 12);
      setCandidates(results);
      if (results.length === 0) toast.info('No matches from the search');
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function save() {
    if (!selectedCity || !selectedCandidate) return;
    setSaving(true);
    try {
      const updated = await saveCityCoordinates(selectedCity.id, selectedCandidate.points);
      setCities((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelectedCity(updated);
      toast.success(`Saved coordinates for ${updated.name}`);
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    // Stacks vertically below md (local tool: tablet-up is the quality bar,
    // but nothing should ever require horizontal scrolling).
    <div className="flex h-full w-full flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      {/* Control panel (inline-start on md+) */}
      <div className="flex shrink-0 flex-col border-b bg-background md:w-[380px] md:border-b-0 md:border-e lg:w-[420px]">
        <div className="border-b px-4 py-3">
          <h1 className="text-sm font-semibold">Geocoding correction (local)</h1>
          <p className="text-xs text-muted-foreground">
            Pick a city, search for the right place, preview, and save.
          </p>
          <Button
            variant={showAll ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 w-full gap-2"
          >
            <Globe className="size-4" />
            {showAll ? 'Hide all cities' : 'Show all cities (as events)'}
          </Button>
        </div>

        {/* City picker */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b p-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">City</label>
            <Input
              placeholder="Filter cities..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[35svh] md:h-auto md:min-h-0 md:flex-1">
            <ul className="p-2">
              {loadingCities && (
                <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading cities...
                </li>
              )}
              {!loadingCities && filteredCities.length === 0 && (
                <li className="px-2 py-3 text-sm text-muted-foreground">No cities.</li>
              )}
              {filteredCities.map((city) => (
                <li key={city.id}>
                  <button
                    type="button"
                    onClick={() => selectCity(city)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors',
                      selectedCity?.id === city.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-accent',
                    )}
                  >
                    <span className="truncate">{city.name}</span>
                    {city.coordinates === null ? (
                      <Badge variant="outline" size="xs" className="shrink-0">
                        unresolved
                      </Badge>
                    ) : city.coordinates.length === 0 ? (
                      <Badge variant="destructive" size="xs" className="shrink-0">
                        no match
                      </Badge>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </div>

      {/* Right: search + map */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b p-3">
          {selectedCity ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-muted-foreground" />
                <span className="font-medium">{selectedCity.name}</span>
                <Badge variant="secondary" size="xs">
                  {geometryLabel(selectedCity)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-40 flex-1"
                  placeholder="Search a place (e.g. a more specific name)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch();
                  }}
                />
                <Button onClick={() => void runSearch()} disabled={searching} className="gap-2">
                  {searching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Search
                </Button>
                <Button
                  variant="default"
                  onClick={() => void save()}
                  disabled={!selectedCandidate || saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a city to begin.</p>
          )}
        </div>

        {/* Candidates sit above the map until lg — at md the side-by-side split
            would leave the preview map under 150px wide. */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Candidate list */}
          <ScrollArea className="h-[30svh] shrink-0 border-b lg:h-auto lg:w-[320px] lg:border-b-0 lg:border-e">
            <ul className="p-2">
              {candidates.length === 0 && (
                <li className="px-2 py-3 text-xs text-muted-foreground">
                  {selectedCity
                    ? 'Run a search to see alternatives. Click one to preview it on the map.'
                    : ''}
                </li>
              )}
              {candidates.map((candidate, i) => (
                <li key={`${candidate.display_name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedCandidate(candidate)}
                    className={cn(
                      'w-full rounded-md px-2 py-2 text-start text-xs transition-colors',
                      selectedCandidate === candidate
                        ? 'bg-success/15 ring-1 ring-success/40'
                        : 'hover:bg-accent',
                    )}
                  >
                    <div className="font-medium">{candidate.display_name ?? '(unnamed)'}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-muted-foreground">
                      {candidate.category && <span>{candidate.category}</span>}
                      {candidate.type && <span>· {candidate.type}</span>}
                      <span>
                        ·{' '}
                        {candidate.point_count <= 1
                          ? 'marker'
                          : `area (${candidate.point_count})`}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>

          {/* Preview map */}
          <div className="relative min-h-[320px] min-w-0 flex-1">
            <GeoPreviewMap
              current={selectedCity?.coordinates ?? null}
              candidate={selectedCandidate?.points ?? null}
              allCities={showAll ? allCities : null}
            />
            <Card
              variant="overlay"
              size="xs"
              className="pointer-events-none absolute bottom-3 start-3 z-10 gap-1 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block size-3 rounded-sm"
                  style={{ background: MAP_COLORS.geoCurrent }}
                />
                Stored
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-block size-3 rounded-sm"
                  style={{ background: MAP_COLORS.geoCandidate }}
                />
                Candidate
              </div>
              {showAll && (
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-sm"
                    style={{ background: MAP_COLORS.active }}
                  />
                  All cities (as event)
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
