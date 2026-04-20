'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

export default function CampaignsPage() {
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mx-auto mb-5">
          <MaterialIcon icon="campaign" className="text-[32px] text-on-surface-variant" />
        </div>
        <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-2">
          Campaigns are temporarily unavailable
        </h1>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
          We&apos;re reworking our broadcast and outreach features to ensure every
          contacted recipient has given prior express consent, as required by TCPA
          and state telemarketing laws. Campaigns will return once that flow is in
          place.
        </p>
        <p className="text-xs text-on-surface-variant/70 mt-6">
          In the meantime, use the <a href="/map" className="text-primary font-semibold hover:underline">Map</a>{' '}
          and <a href="/leads" className="text-primary font-semibold hover:underline">Leads</a> to prospect manually.
        </p>
      </div>
    </div>
  );
}
