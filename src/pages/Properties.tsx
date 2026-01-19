import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, MapPin, Bed, Bath, Maximize, Filter, Search, Sparkles, Loader2, ChevronDown, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { List, LayoutGrid } from "lucide-react";

const Properties = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [aiSearch, setAiSearch] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const navigate = useNavigate();

  // Filter state
  const [filters, setFilters] = useState({
    listingType: 'market', // 'market' | 'my'
    propertyType: '',
    minPrice: '',
    maxPrice: '',
    bedrooms: '',
    bathrooms: '',
    minSize: '',
    maxSize: '',
    location: '',
    yearBuilt: '',
    status: '',
  });

  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const { data: properties, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  // Apply filters
  const filteredProperties = properties?.filter((property: any) => {
    // AI Search
    if (aiSearch && !`${property.name} ${property.address} ${property.type}`.toLowerCase().includes(aiSearch.toLowerCase())) {
      return false;
    }
    // Property Type
    if (filters.propertyType && property.type?.toLowerCase() !== filters.propertyType.toLowerCase()) {
      return false;
    }
    // Price Range
    if (filters.minPrice && property.price < parseInt(filters.minPrice)) return false;
    if (filters.maxPrice && property.price > parseInt(filters.maxPrice)) return false;
    // Bedrooms
    if (filters.bedrooms && property.bedrooms < parseInt(filters.bedrooms)) return false;
    // Bathrooms
    if (filters.bathrooms && property.bathrooms < parseInt(filters.bathrooms)) return false;
    // Size
    if (filters.minSize && property.built_size < parseInt(filters.minSize)) return false;
    if (filters.maxSize && property.built_size > parseInt(filters.maxSize)) return false;

    return true;
  }) || [];

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters, aiSearch]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

  const activeFiltersCount = [
    filters.propertyType,
    filters.minPrice,
    filters.maxPrice,
    filters.bedrooms,
    filters.bathrooms,
    filters.minSize,
    filters.maxSize,
    filters.location,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilters({
      ...filters,
      propertyType: '',
      minPrice: '',
      maxPrice: '',
      bedrooms: '',
      bathrooms: '',
      minSize: '',
      maxSize: '',
      location: '',
      yearBuilt: '',
      status: '',
    });
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Notion-style Header */}
      <div className="px-8 md:px-12 pt-8 pb-4 border-b border-border/40 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground/90">Properties</h1>
            <span className="text-sm text-muted-foreground">
              {filteredProperties.length} listings
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSearchVisible ? (
              <div className="flex items-center relative transition-all animate-in fade-in zoom-in-95 duration-200">
                <Sparkles className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input
                  autoFocus
                  placeholder="AI Search: Describe what you're looking for..."
                  value={aiSearch}
                  onChange={(e) => setAiSearch(e.target.value)}
                  onBlur={() => !aiSearch && setIsSearchVisible(false)}
                  className="pl-9 h-8 rounded-sm bg-muted/50 border-transparent focus:bg-background focus:ring-1 focus:ring-ring text-sm w-[300px] transition-all"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 absolute right-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setAiSearch('');
                    setIsSearchVisible(false);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setIsSearchVisible(true)} className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50">
                <Search className="h-4 w-4" />
              </Button>
            )}

            {/* Filter Button with Sheet */}
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 relative">
                  <Filter className="h-4 w-4" />
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-foreground text-background text-[10px] rounded-full flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
                <SheetHeader className="pb-6 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="text-base font-medium">Filters</SheetTitle>
                    {activeFiltersCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                        Clear all
                      </Button>
                    )}
                  </div>
                </SheetHeader>

                <div className="py-6 space-y-6">
                  {/* Listing Type Toggle */}
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                      Show
                    </Label>
                    <div className="flex gap-1 p-1 bg-muted/50 rounded-md">
                      <button
                        onClick={() => setFilters({ ...filters, listingType: 'market' })}
                        className={`flex-1 py-1.5 px-3 text-sm rounded transition-colors ${filters.listingType === 'market'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        Market Listings
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, listingType: 'my' })}
                        className={`flex-1 py-1.5 px-3 text-sm rounded transition-colors ${filters.listingType === 'my'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        My Listings
                      </button>
                    </div>
                  </div>

                  {/* Property Type */}
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                      Property Type
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {['Apartment', 'House', 'Villa', 'Penthouse', 'Townhouse', 'Land'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setFilters({ ...filters, propertyType: filters.propertyType === type ? '' : type })}
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${filters.propertyType === type
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                            }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Range */}
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                      Price Range
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Min €"
                        value={filters.minPrice}
                        onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                        className="h-9 text-sm"
                      />
                      <span className="text-muted-foreground">—</span>
                      <Input
                        type="number"
                        placeholder="Max €"
                        value={filters.maxPrice}
                        onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* Bedrooms */}
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                      Bedrooms
                    </Label>
                    <div className="flex gap-2">
                      {['Any', '1+', '2+', '3+', '4+', '5+'].map((num, idx) => (
                        <button
                          key={num}
                          onClick={() => setFilters({ ...filters, bedrooms: idx === 0 ? '' : String(idx) })}
                          className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${(idx === 0 && !filters.bedrooms) || filters.bedrooms === String(idx)
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                            }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Bathrooms */}
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                      Bathrooms
                    </Label>
                    <div className="flex gap-2">
                      {['Any', '1+', '2+', '3+', '4+'].map((num, idx) => (
                        <button
                          key={num}
                          onClick={() => setFilters({ ...filters, bathrooms: idx === 0 ? '' : String(idx) })}
                          className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${(idx === 0 && !filters.bathrooms) || filters.bathrooms === String(idx)
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                            }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Secondary Filters - Collapsible */}
                  <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <span>More filters</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${secondaryOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-6 pt-4">
                      {/* Size Range */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                          Size (m²)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Min m²"
                            value={filters.minSize}
                            onChange={(e) => setFilters({ ...filters, minSize: e.target.value })}
                            className="h-9 text-sm"
                          />
                          <span className="text-muted-foreground">—</span>
                          <Input
                            type="number"
                            placeholder="Max m²"
                            value={filters.maxSize}
                            onChange={(e) => setFilters({ ...filters, maxSize: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                          Location
                        </Label>
                        <Input
                          placeholder="City, area, or address..."
                          value={filters.location}
                          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>

                      {/* Year Built */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">
                          Year Built
                        </Label>
                        <Input
                          type="number"
                          placeholder="From year..."
                          value={filters.yearBuilt}
                          onChange={(e) => setFilters({ ...filters, yearBuilt: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                {/* Apply Button */}
                <div className="pt-4 border-t border-border/40">
                  <Button
                    onClick={() => setFiltersOpen(false)}
                    className="w-full"
                  >
                    Show {filteredProperties.length} properties
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="w-[1px] h-4 bg-border/60 mx-1" />

            <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-md">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-sm transition-all ${viewMode === 'table' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-transparent hover:text-foreground'}`}
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-transparent hover:text-foreground'}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Properties Grid */}
      <div className="px-8 md:px-12 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
          </div>
        ) : filters.listingType === 'my' ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Your property listings will appear here
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No properties found</p>
            {activeFiltersCount > 0 && (
              <Button variant="link" onClick={clearFilters} className="mt-2 text-sm">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'table' ? (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Image</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProperties.map((property: any) => (
                      <TableRow key={property.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/properties/${property.id}`)}>
                        <TableCell>
                          <div className="h-12 w-16 bg-muted rounded-sm overflow-hidden">
                            {property.pictures && property.pictures.length > 0 ? (
                              <img src={property.pictures[0]} alt={property.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground">
                                <Building2 className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{property.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {property.address}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize text-sm">{property.type?.toLowerCase()}</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">€{property.price?.toLocaleString()}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {property.bedrooms > 0 && <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {property.bedrooms}</span>}
                            {property.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {property.bathrooms}</span>}
                            {property.built_size > 0 && <span className="flex items-center gap-1"><Maximize className="h-3 w-3" /> {property.built_size}m²</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {paginatedProperties.map((property: any) => (
                  <Card
                    key={property.id}
                    className="overflow-hidden cursor-pointer border-border/40 hover:border-border/80 transition-colors shadow-none"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    {property.pictures && property.pictures.length > 0 ? (
                      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                        <img
                          src={property.pictures[0]}
                          alt={property.name || 'Property'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}

                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-medium line-clamp-1 text-foreground/90">
                        {property.name || 'Unnamed Property'}
                      </CardTitle>
                      {property.address && (
                        <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="line-clamp-1">{property.address}</span>
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="p-4 pt-0">
                      <div className="space-y-2">
                        {property.price && (
                          <div className="text-base font-semibold text-foreground">
                            €{property.price.toLocaleString()}
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {property.type && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              <span className="capitalize">{property.type.toLowerCase()}</span>
                            </div>
                          )}
                          {property.bedrooms > 0 && (
                            <div className="flex items-center gap-1">
                              <Bed className="h-3 w-3" />
                              <span>{property.bedrooms}</span>
                            </div>
                          )}
                          {property.bathrooms > 0 && (
                            <div className="flex items-center gap-1">
                              <Bath className="h-3 w-3" />
                              <span>{property.bathrooms}</span>
                            </div>
                          )}
                          {property.built_size > 0 && (
                            <div className="flex items-center gap-1">
                              <Maximize className="h-3 w-3" />
                              <span>{property.built_size}m²</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-6">
                <div className="text-xs text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredProperties.length)} of {filteredProperties.length} listings
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 text-xs"
                  >
                    Previous
                  </Button>
                  <div className="text-xs font-medium">
                    Page {page} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Properties;
