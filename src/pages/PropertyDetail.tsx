import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Maximize,
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  ExternalLink,
} from "lucide-react";

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("properties")
        .select(`
          *,
          location:locations(id, name, type, latitude, longitude)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: features } = useQuery({
    queryKey: ["property-features", id],
    queryFn: async () => {
      const { data: links, error: linksError } = await supabase
        .from("property_features")
        .select("feature_id, kind")
        .eq("property_id", id);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return [];

      const featureIds = links.map(l => l.feature_id);
      const { data: featureDetails, error: featuresError } = await supabase
        .from("features")
        .select("id, name, icon, key")
        .in("id", featureIds);

      if (featuresError) throw featuresError;

      return links.map(link => {
        const detail = featureDetails?.find(f => f.id === link.feature_id);
        const key = detail?.key || '';

        let displayGroup = link.kind;
        if (link.kind === 'FEATURE') {
          if (key.startsWith('orientation_')) displayGroup = 'ORIENTATION';
          else if (key.startsWith('condition_')) displayGroup = 'CONDITION';
          else if (key.startsWith('utilities_')) displayGroup = 'UTILITIES';
          else if (key.startsWith('category_')) displayGroup = 'CATEGORY';
        }

        return {
          kind: link.kind,
          displayGroup: displayGroup,
          features: detail ? { name: detail.name, icon: detail.icon } : { name: 'Unknown', icon: null }
        };
      }).filter(item => item.features.name !== 'Unknown');
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <h2 className="text-base font-medium text-gray-900 mb-4">Property not found</h2>
          <Button variant="outline" size="sm" onClick={() => navigate("/properties")}>
            Back to Properties
          </Button>
        </div>
      </div>
    );
  }

  const pictures = property.pictures || [];
  const selectedImage = pictures[selectedImageIndex];

  const latitude = property.latitude || property.location?.latitude;
  const longitude = property.longitude || property.location?.longitude;
  const hasCoordinates = latitude && longitude;

  const description = property.content || '';
  const shouldTruncate = description.length > 500;
  const displayedDescription = shouldTruncate && !isDescriptionExpanded
    ? description.slice(0, 500) + '...'
    : description;

  return (
    <div className="min-h-screen bg-white">
      {/* Two Column Layout */}
      <div className="flex flex-col lg:flex-row min-h-screen">

        {/* Left Column - Sticky Photos */}
        <div className="lg:w-[55%] lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden bg-gray-50">
          <div className="h-full flex flex-col">
            {/* Back Button - Notion style */}
            <div className="p-4">
              <button
                onClick={() => navigate("/properties")}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 px-2 py-1 -ml-2 rounded transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Properties</span>
              </button>
            </div>

            {pictures.length > 0 ? (
              <>
                {/* Main Image */}
                <div className="flex-1 relative group mx-4 mb-3">
                  <div className="absolute inset-0 rounded-lg overflow-hidden">
                    <img
                      src={selectedImage}
                      alt={`${property.name} - ${selectedImageIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Navigation */}
                  {pictures.length > 1 && (
                    <>
                      <button
                        onClick={() => setSelectedImageIndex(prev => prev > 0 ? prev - 1 : pictures.length - 1)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => setSelectedImageIndex(prev => prev < pictures.length - 1 ? prev + 1 : 0)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-600" />
                      </button>
                    </>
                  )}

                  {/* Counter */}
                  <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/60 text-white text-xs rounded">
                    {selectedImageIndex + 1} / {pictures.length}
                  </div>
                </div>

                {/* Thumbnails */}
                {pictures.length > 1 && (
                  <div className="px-4 pb-4">
                    <div className="flex gap-1.5 overflow-x-auto">
                      {pictures.slice(0, 8).map((pic: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImageIndex(idx)}
                          className={`flex-shrink-0 w-14 h-14 rounded overflow-hidden transition-all ${idx === selectedImageIndex
                              ? 'ring-2 ring-gray-900 ring-offset-1'
                              : 'opacity-60 hover:opacity-100'
                            }`}
                        >
                          <img src={pic} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {pictures.length > 8 && (
                        <button
                          onClick={() => setSelectedImageIndex(8)}
                          className="flex-shrink-0 w-14 h-14 rounded bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 hover:bg-gray-300"
                        >
                          +{pictures.length - 8}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                No images
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Scrollable Content */}
        <div className="lg:w-[45%] lg:overflow-y-auto">
          <div className="max-w-xl p-6 lg:p-10">

            {/* Title */}
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              {property.name || "Unnamed Property"}
            </h1>

            {property.address && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
                <MapPin className="h-3.5 w-3.5" />
                <span>{property.address}</span>
              </div>
            )}

            {/* Price */}
            {property.price && (
              <div className="text-3xl font-bold text-gray-900 mb-6">
                €{property.price.toLocaleString()}
              </div>
            )}

            {/* Specs - Notion style horizontal */}
            <div className="flex flex-wrap gap-2 mb-8 pb-8 border-b border-gray-100">
              {property.type && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded text-sm text-gray-700">
                  <Home className="h-3.5 w-3.5 text-gray-400" />
                  <span className="capitalize">{property.type.toLowerCase()}</span>
                </div>
              )}
              {property.bedrooms > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded text-sm text-gray-700">
                  <Bed className="h-3.5 w-3.5 text-gray-400" />
                  <span>{property.bedrooms} bed</span>
                </div>
              )}
              {property.bathrooms > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded text-sm text-gray-700">
                  <Bath className="h-3.5 w-3.5 text-gray-400" />
                  <span>{property.bathrooms} bath</span>
                </div>
              )}
              {property.built_size > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded text-sm text-gray-700">
                  <Maximize className="h-3.5 w-3.5 text-gray-400" />
                  <span>{property.built_size}m²</span>
                </div>
              )}
            </div>

            {/* Description */}
            {description && (
              <div className="mb-8">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Description
                </h2>
                <p className="text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {displayedDescription}
                </p>
                {shouldTruncate && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mt-3"
                  >
                    {isDescriptionExpanded ? (
                      <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
                    ) : (
                      <>Show more <ChevronDown className="h-3.5 w-3.5" /></>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Details Grid */}
            <div className="mb-8">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Details
              </h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {property.location?.name && (
                  <div>
                    <div className="text-xs text-gray-400 capitalize">{property.location.type || 'Location'}</div>
                    <div className="text-sm text-gray-900">{property.location.name}</div>
                  </div>
                )}
                {property.built_size > 0 && (
                  <div>
                    <div className="text-xs text-gray-400">Built Size</div>
                    <div className="text-sm text-gray-900">{property.built_size}m²</div>
                  </div>
                )}
                {property.living_size > 0 && (
                  <div>
                    <div className="text-xs text-gray-400">Interior</div>
                    <div className="text-sm text-gray-900">{property.living_size}m²</div>
                  </div>
                )}
                {property.terrace_size > 0 && (
                  <div>
                    <div className="text-xs text-gray-400">Terrace</div>
                    <div className="text-sm text-gray-900">{property.terrace_size}m²</div>
                  </div>
                )}
                {property.garden_plot_size > 0 && (
                  <div>
                    <div className="text-xs text-gray-400">Garden/Plot</div>
                    <div className="text-sm text-gray-900">{property.garden_plot_size}m²</div>
                  </div>
                )}
                {property.floor && (
                  <div>
                    <div className="text-xs text-gray-400">Floor</div>
                    <div className="text-sm text-gray-900">{property.floor}</div>
                  </div>
                )}
                {property.year_built > 0 && (
                  <div>
                    <div className="text-xs text-gray-400">Year Built</div>
                    <div className="text-sm text-gray-900">{property.year_built}</div>
                  </div>
                )}
                {property.levels > 0 && (
                  <div>
                    <div className="text-xs text-gray-400">Levels</div>
                    <div className="text-sm text-gray-900">{property.levels}</div>
                  </div>
                )}
                {property.community_fees > 0 && (
                  <div>
                    <div className="text-xs text-gray-400">Community Fees</div>
                    <div className="text-sm text-gray-900">€{property.community_fees}/yr</div>
                  </div>
                )}
                {property.ibi_fees > 0 && (
                  <div>
                    <div className="text-xs text-gray-400">IBI</div>
                    <div className="text-sm text-gray-900">€{property.ibi_fees}/yr</div>
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            {hasCoordinates && (
              <div className="mb-8">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Location
                </h2>
                <div className="relative rounded-lg overflow-hidden border border-gray-100">
                  <iframe
                    title="Property Location"
                    width="100%"
                    height="220"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.008},${latitude - 0.005},${longitude + 0.008},${latitude + 0.005}&layer=mapnik&marker=${latitude},${longitude}`}
                  />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-white/95 rounded text-xs text-gray-600 hover:text-gray-900 shadow-sm"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Google Maps
                  </a>
                </div>
              </div>
            )}

            {/* Advanced Features */}
            {features && features.length > 0 && (
              <div className="mb-8 pt-8 border-t border-gray-100">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                  Features
                </h2>

                <div className="space-y-5">
                  {[
                    { group: 'LOCATION_TYPE', label: 'Setting' },
                    { group: 'ORIENTATION', label: 'Orientation' },
                    { group: 'CONDITION', label: 'Condition' },
                    { group: 'VIEW', label: 'Views' },
                    { group: 'CLIMATE_CONTROL', label: 'Climate' },
                    { group: 'POOL', label: 'Pool' },
                    { group: 'PARKING', label: 'Parking' },
                    { group: 'KITCHEN', label: 'Kitchen' },
                    { group: 'FURNITURE', label: 'Furniture' },
                    { group: 'SECURITY', label: 'Security' },
                    { group: 'UTILITIES', label: 'Utilities' },
                    { group: 'CATEGORY', label: 'Category' },
                    { group: 'FEATURE', label: 'Other' },
                  ].map(section => {
                    const groupFeatures = features.filter(f => f.displayGroup === section.group);
                    if (groupFeatures.length === 0) return null;

                    return (
                      <div key={section.group}>
                        <h3 className="text-sm text-gray-900 font-medium mb-2">{section.label}</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {groupFeatures.map((f, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs"
                            >
                              <Check className="h-3 w-3 text-green-500" />
                              {f.features.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-6 border-t border-gray-100 text-xs text-gray-400">
              <div className="flex gap-4">
                <span>Created {new Date(property.created_at).toLocaleDateString()}</span>
                <span>Updated {new Date(property.updated_at).toLocaleDateString()}</span>
              </div>
              {property.resale_ref && (
                <div className="mt-1 font-mono">Ref: {property.resale_ref}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
