import { Pricing } from '@/components/ui/pricing-section-with-comparison';
import { HeroHeader } from '@/components/HeroHeader';

const pricingData = {
  plans: [
    {
      name: 'Bronze',
      description: 'Perfect for getting started with AI-powered real estate tools',
      onboardingPrice: 'Free',
      officePrice: 'Free',
      agentPrice: '€57',
      priceLabel: '/ month',
      firstClientOnboarding: 'Free',
      firstClientOffice: 'Free',
      firstClientAgent: '€37',
      minSeats: 1,
      featured: false,
    },
    {
      name: 'Silver',
      description: 'Advanced features for growing agencies',
      onboardingPrice: '€897',
      officePrice: '€347',
      agentPrice: '€97',
      priceLabel: '/ month',
      firstClientOnboarding: '€647',
      firstClientOffice: '€247',
      firstClientAgent: '€67',
      minSeats: 3,
      featured: false,
    },
    {
      name: 'Gold',
      description: 'Complete solution for established real estate businesses',
      onboardingPrice: '€1,997',
      officePrice: '€297',
      agentPrice: '€67',
      priceLabel: '/ month',
      firstClientOnboarding: '€997',
      firstClientOffice: '€197',
      firstClientAgent: '€47',
      minSeats: 10,
      featured: true,
    },
  ],
  featureSections: [
    {
      title: 'Property "Hub"',
      features: [
        { name: 'AI Property recommendation', values: ['-', '+', '+'] },
        { name: 'API to your Listings & your MLS', values: ['+', '+', '+'] },
        { name: 'Personal WhatsApp', values: ['-', '+', '+'] },
        { name: 'International portals', values: ['-', '-', '+'] },
        { name: 'Traditional search', values: ['+', '+', '+'] },
        { name: 'Email share', values: ['+', '+', '+'] },
        { name: 'WhatsApp share', values: ['+', '+', '+'] },
        { name: 'Applicant data', values: ['-', '+', '+'] },
        { name: 'Standard presentation', values: ['+', '-', '-'] },
        { name: 'Personalised presentations', values: ['-', 'Extra', '+'] },
        { name: 'Area reports (V2)', values: ['-', '+', '+'] },
        { name: 'Buy profile reports (V2)', values: ['-', '+', '+'] },
      ],
    },
    {
      title: 'Lead connection',
      features: [
        { name: 'Paid marketing leads (Meta/Google)', values: ['-', '+', '+'] },
        { name: 'Idealista leads', values: ['+', '+', '+'] },
        { name: 'International leads', values: ['-', '-', '+'] },
        { name: 'Your website leads', values: ['-', '+', '+'] },
        { name: 'CRM integration', values: ['-', '+', '+'] },
        { name: 'Our CRM partner', values: ['Extra', 'Extra', 'Extra'] },
        { name: 'Organic leads (Meta/Google)', values: ['-', '+', '+'] },
      ],
    },
    {
      title: 'Lead Qualification',
      features: [
        { name: 'AI outreach (WhatsApp, email)', values: ['Autoresponce only', '+', '+'] },
        { name: 'AI Call agent', values: ['Extra', '+', '+'] },
        { name: 'Personalised AI call agent', values: ['-', '-', '+'] },
        { name: 'AI Complete registration', values: ['-', '+', '+'] },
        { name: 'AI Property search/selection', values: ['-', '+', '+'] },
        { name: 'Lead enrichment', values: ['-', '+', '+'] },
      ],
    },
    {
      title: 'Lead Nurturing',
      features: [
        { name: 'AI Property Scanning', values: ['-', '+', '+'] },
        { name: 'AI Agent for personalised updates', values: ['-', '+', '+'] },
        { name: 'AI behaviour engagement', values: ['-', '+', '+'] },
        { name: 'AI "Hot leads" identification', values: ['-', '-', '+'] },
        { name: 'AI nurturing flow selection', values: ['-', '-', '+'] },
      ],
    },
    {
      title: 'AI personal assistant',
      features: [
        { name: 'AI client management', values: ['-', '+', '+'] },
        { name: 'Voice AI assistant', values: ['+', '+', '+'] },
        { name: 'Daily Assistant follow-up calls', values: ['+', '+', '+'] },
        { name: 'Property proposals', values: ['-', '+', '+'] },
        { name: 'Viewing Feedback and Daily reports', values: ['-', '+', '+'] },
      ],
    },
    {
      title: 'Admin reports and review',
      features: [
        { name: 'Owners / Managers reports', values: ['-', '+', '+'] },
        { name: 'Agent activity reports', values: ['-', '+', '+'] },
        { name: 'AI commission estimates', values: ['-', '+', '+'] },
        { name: 'Vendor reports by AI', values: ['-', '+', '+'] },
        { name: 'Lead generation monitoring', values: ['-', '+', '+'] },
      ],
    },
  ],
};

export default function PricingPage() {
  return (
    <>
      <HeroHeader />
      <div className="pt-24">
        <Pricing data={pricingData} highlightFirstClientOffer />
      </div>
    </>
  );
}
