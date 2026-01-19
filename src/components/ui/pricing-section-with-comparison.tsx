import { useRef, useState } from "react";
import { Check, Minus, MoveRight, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface PricingData {
  plans: Array<{
    name: string;
    description: string;
    onboardingPrice: string;
    officePrice: string;
    agentPrice: string;
    priceLabel: string;
    firstClientOnboarding?: string;
    firstClientOffice?: string;
    firstClientAgent?: string;
    minSeats: number;
    featured?: boolean;
  }>;
  featureSections: Array<{
    title: string;
    features: Array<{
      name: string;
      values: Array<string | boolean>;
    }>;
  }>;
}

function Pricing({
  data,
  highlightFirstClientOffer = false,
}: {
  data: PricingData;
  highlightFirstClientOffer?: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;

    try {
      setIsGenerating(true);
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // Improve quality
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape', // Landscape usually fits pricing tables better
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('pricing-plans.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full py-20 lg:py-40">
      <div className="container mx-auto">
        <div className="flex text-center justify-center items-center gap-4 flex-col mb-8">
          <Badge>Pricing</Badge>
          <div className="flex gap-2 flex-col">
            <h2 className="text-3xl md:text-5xl tracking-tighter max-w-xl text-center font-regular">
              Prices that make sense!
            </h2>
            <p className="text-lg leading-relaxed tracking-tight text-muted-foreground max-w-xl text-center">
              Choose the perfect plan for your real estate business
            </p>
          </div>

          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            disabled={isGenerating}
            className="mt-4 gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </Button>
        </div>

        <div ref={printRef} className="bg-background p-4 rounded-xl">
          <div className="grid text-left w-full grid-cols-3 lg:grid-cols-4">
            {/* Empty header cell */}
            <div className="col-span-3 lg:col-span-1 border-r border-border"></div>

            {/* Plan headers */}
            {data.plans.map((plan, idx) => (
              <div key={plan.name} className={`px-3 py-1 md:px-6 md:py-4 gap-2 flex flex-col ${idx < data.plans.length - 1 ? 'border-r border-border' : ''}`}>
                <p className="text-2xl font-semibold">{plan.name}</p>
                <div className="flex flex-col gap-3 mt-4">
                  {/* Standard Pricing */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-muted-foreground">Onboarding:</span>
                      <span className="text-lg font-bold">{plan.onboardingPrice}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-muted-foreground">Office:</span>
                      <span className="text-lg font-bold">{plan.officePrice}</span>
                      <span className="text-xs text-muted-foreground">{plan.priceLabel}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-muted-foreground">Per agent:</span>
                      <span className="text-lg font-bold">{plan.agentPrice}</span>
                      <span className="text-xs text-muted-foreground">{plan.priceLabel}</span>
                    </div>
                  </div>

                  {plan.firstClientOnboarding ? (
                    highlightFirstClientOffer ? (
                      <div className="mt-6 rounded-[32px] border border-amber-200 bg-amber-50/60 px-4 py-5 flex flex-col gap-3">
                        <Badge
                          className="text-xs w-fit bg-amber-100 text-amber-700 border border-amber-200"
                        >
                          First Client Offer
                        </Badge>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-muted-foreground">Onboarding:</span>
                          <span className="text-base font-semibold text-primary">
                            {plan.firstClientOnboarding}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-muted-foreground">Office:</span>
                          <span className="text-base font-semibold text-primary">
                            {plan.firstClientOffice}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-muted-foreground">Per agent:</span>
                          <span className="text-base font-semibold text-primary">
                            {plan.firstClientAgent}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Min {plan.minSeats} {plan.minSeats === 1 ? "seat" : "seats"}
                        </p>
                        <Button
                          variant={plan.featured ? "default" : "outline"}
                          className="gap-4 mt-3 w-full"
                          data-html2canvas-ignore
                        >
                          Get Started <MoveRight className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2 pt-2 border-t border-border">
                          <Badge variant="secondary" className="text-xs w-fit">
                            First Client Offer
                          </Badge>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-muted-foreground">Onboarding:</span>
                            <span className="text-base font-semibold text-primary">
                              {plan.firstClientOnboarding}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-muted-foreground">Office:</span>
                            <span className="text-base font-semibold text-primary">
                              {plan.firstClientOffice}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-muted-foreground">Per agent:</span>
                            <span className="text-base font-semibold text-primary">
                              {plan.firstClientAgent}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Min {plan.minSeats} {plan.minSeats === 1 ? "seat" : "seats"}
                        </p>
                        <Button
                          variant={plan.featured ? "default" : "outline"}
                          className="gap-4 mt-4"
                          data-html2canvas-ignore
                        >
                          Get Started <MoveRight className="w-4 h-4" />
                        </Button>
                      </>
                    )
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Min {plan.minSeats} {plan.minSeats === 1 ? "seat" : "seats"}
                      </p>
                      <Button
                        variant={plan.featured ? "default" : "outline"}
                        className="gap-4 mt-4"
                        data-html2canvas-ignore
                      >
                        Get Started <MoveRight className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Feature Sections */}
            {data.featureSections.map((section, sectionIdx) => (
              <div key={sectionIdx} className="contents">
                {/* Section Header with separator */}
                {sectionIdx > 0 && (
                  <>
                    <div className="col-span-3 lg:col-span-4 h-px bg-border my-2"></div>
                  </>
                )}

                <div className="px-3 lg:px-6 col-span-3 lg:col-span-1 py-4 border-r border-border">
                  <b className="text-base">{section.title}</b>
                </div>
                <div className="border-r border-border"></div>
                <div className="border-r border-border"></div>
                <div></div>

                {/* Feature rows in this section */}
                {section.features.map((feature, featureIdx) => (
                  <div key={featureIdx} className="contents">
                    <div className="px-3 lg:px-6 col-span-3 lg:col-span-1 py-4 border-b border-border border-r border-border">
                      {feature.name}
                    </div>
                    {feature.values.map((value, valueIdx) => (
                      <div key={valueIdx} className={`px-3 py-1 md:px-6 md:py-4 flex justify-center items-center border-b border-border ${valueIdx < feature.values.length - 1 ? 'border-r border-border' : ''}`}>
                        {value === true || value === '+' ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : value === false || value === '-' ? (
                          <Minus className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <p className="text-muted-foreground text-sm text-center">{value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>All prices in EUR. First client offer requires 12-month minimum commitment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Pricing };
