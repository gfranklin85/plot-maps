'use client';

import { Lead } from '@/types';
import { formatDate } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  leads: Lead[];
}

export default function RecentLeads({ leads }: Props) {
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline text-lg font-bold text-on-surface">
          Recently Imported Leads
        </h3>
        <a
          href="/leads"
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          View All Imports
          <MaterialIcon icon="arrow_forward" className="text-[16px]" />
        </a>
      </div>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-secondary">
          <MaterialIcon icon="group_add" className="text-[48px] text-slate-300 mb-2" />
          <p className="text-sm">No leads imported yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant text-xs font-label uppercase tracking-widest text-secondary">
                <th className="pb-3 pr-4 font-semibold">Owner / Contact</th>
                <th className="pb-3 pr-4 font-semibold">Property</th>
                <th className="pb-3 font-semibold">Date Added</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-outline-variant/40 last:border-0 transition-colors hover:bg-surface-container-low"
                >
                  <td className="py-3 pr-4">
                    <p className="font-bold text-on-surface">{lead.name}</p>
                    <p className="text-xs text-secondary">
                      {lead.phone ?? lead.email ?? '--'}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-sm text-on-surface">
                      {lead.property_address ?? '--'}
                    </p>
                  </td>
                  <td className="py-3">
                    <p className="text-xs text-secondary whitespace-nowrap">
                      {formatDate(lead.created_at)}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
