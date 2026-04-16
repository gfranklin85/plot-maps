"use client";

import { useMemo } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useProfile } from "@/lib/profile-context";
import {
  CIRCLE_PROSPECTING_BASE_PROMPT,
  buildCampaignInjection,
  buildFirstMessageTemplate,
  generateHookVariants,
} from "@/lib/campaign-prompts";
import type { WizardState } from "../CampaignWizard";

interface Props {
  state: WizardState;
}

export default function StepPreview({ state }: Props) {
  const { profile } = useProfile();
  const agentFirst = (profile.fullName || "Agent").split(" ")[0];

  const preview = useMemo(() => {
    const injection = buildCampaignInjection(state.referenceLeads, state.allowedFacts);
    const firstMsgTemplate = buildFirstMessageTemplate(state.assistantName);
    const hooks = generateHookVariants(state.referenceLeads, state.allowedFacts);

    // Fill a sample first message
    const sampleHook = hooks[0]?.variants[0] || "";
    const firstMessage = firstMsgTemplate
      .replace("{owner_first_name}", "Robert")
      .replace("{agent_first_name}", agentFirst)
      .replace("{agent_company}", profile.company || "your brokerage")
      .replace("{property_city}", state.referenceLeads[0]?.city || "the area")
      .replace("{hook}", sampleHook);

    const systemPrompt = CIRCLE_PROSPECTING_BASE_PROMPT
      .replace("{assistant_name}", state.assistantName)
      .replace(/{agent_first_name}/g, agentFirst)
      .replace(/{agent_company}/g, profile.company || "your brokerage")
      .replace(/{property_city}/g, state.referenceLeads[0]?.city || "the area")
      .replace("{campaign_injection}", injection);

    return { firstMessage, systemPrompt, hooks, injection };
  }, [state, agentFirst, profile.company, profile.fullName]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline text-xl font-extrabold text-on-surface">
          Preview Campaign
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Review what your AI assistant will say before publishing.
        </p>
      </div>

      {/* Campaign summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-container-lowest border border-card-border p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Campaign</p>
          <p className="text-sm font-bold text-on-surface mt-1">{state.name}</p>
        </div>
        <div className="rounded-xl bg-surface-container-lowest border border-card-border p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">AI Name</p>
          <p className="text-sm font-bold text-violet-400 mt-1">{state.assistantName}</p>
        </div>
      </div>

      {/* First message */}
      <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <MaterialIcon icon="chat_bubble" className="text-[16px] text-violet-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Sample First Message
          </p>
        </div>
        <p className="text-sm text-on-surface leading-relaxed italic">
          &ldquo;{preview.firstMessage}&rdquo;
        </p>
        <p className="text-[10px] text-on-surface-variant/50 mt-2">
          Owner name and hook will change per prospect.
        </p>
      </div>

      {/* Hook variants */}
      <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <MaterialIcon icon="format_list_bulleted" className="text-[16px] text-emerald-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Hook Variants ({preview.hooks.reduce((s, h) => s + h.variants.length, 0)} total)
          </p>
        </div>
        <div className="space-y-3">
          {preview.hooks.map((group, gi) => (
            <div key={gi}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">
                {group.type} reference
              </p>
              {group.variants.map((v, vi) => (
                <p key={vi} className="text-xs text-on-surface leading-relaxed py-1.5 border-b border-card-border/30 last:border-0">
                  {vi + 1}. &ldquo;{v}&rdquo;
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* System prompt (collapsed) */}
      <details className="rounded-xl bg-surface-container-lowest border border-card-border">
        <summary className="flex items-center gap-2 p-4 cursor-pointer select-none">
          <MaterialIcon icon="code" className="text-[16px] text-on-surface-variant" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Full System Prompt
          </p>
        </summary>
        <div className="px-4 pb-4">
          <pre className="text-[11px] text-on-surface-variant leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
            {preview.systemPrompt}
          </pre>
        </div>
      </details>
    </div>
  );
}
