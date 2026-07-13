'use client';

// ── AgentDashboard — the two-verb sky dashboard ───────────────────────
//
// Replaces the cluttered DashboardSurface. An agent does two things we can
// build now: PROSPECT (reach people) and TRANSACT (do the deal). Each is a
// floating-island door in the sky world; clicking one is a FOCUSED TAKEOVER
// (it fills the sky, the other recedes, collapse to return) — NO page
// navigation (Greg: minimize load waits). GROW/marketing is shelved.
//
// PROSPECT (fully working): the leads/CRM table + Add Client (name+contact),
// import, skip-trace (all reachable). TRANSACT (real shell): the active deal
// (Alberto) rendered via DealRoomGate; real persistence is the next pass.
// memory: feedback_brand_fidelity (navy ink, #1349d4), feedback_one_viewport_pages,
// project_pin_grammar (sky assets), the_platform_inventory (who-am-I dashboard).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfile } from '@/lib/profile-context';
import MaterialIcon from '@/components/ui/MaterialIcon';
import LeadsList from '@/components/leads/LeadsList';
import AddClientForm from '@/components/dashboard/prospect/AddClientForm';
import DealRoomGate from '@/components/deal/DealRoomGate';
import { DEMO_PACKAGE } from '@/lib/deal/offerPackage';
import type { Lead } from '@/types';

const BRAND = 'var(--plot-brand, #1349d4)';
const INK = 'var(--plot-brand-deep, #122d8d)';

interface MyRequest { id: string; to_label: string | null; from_label: string | null; status: string }
type Island = 'prospect' | 'transact' | null;

export default function AgentDashboard() {
  const router = useRouter();
  const { profile } = useProfile();
  const first = (profile.fullName || '').trim().split(/\s+/)[0] || '';

  const [active, setActive] = useState<Island>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // the agent's own move-requests (they're movers too) — compact personal corner
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  useEffect(() => {
    fetch('/api/move-request?mine=1').then((r) => r.json()).then((d) => setMyRequests(d.requests ?? [])).catch(() => {});
  }, []);

  const selectLead = (lead: Lead) => router.push(`/leads/${lead.id}`);

  return (
    <div className="agd">
      {/* the sky world backdrop (calm, quiet) */}
      <div className="agd__sky" aria-hidden>
        <div className="agd__sun" />
        <img src="/sky/cloud.png" alt="" className="agd__cloud c1" />
        <img src="/sky/cloud-long.png" alt="" className="agd__cloud c2" />
      </div>

      <div className="agd__wrap">
        <div className="agd__greet">
          <div className="agd__eyebrow">Your workspace</div>
          <h1 className="font-headline agd__h">Welcome back{first ? `, ${first}` : ''}.</h1>
        </div>

        {/* ── the two islands / expanded workspace ── */}
        <AnimatePresence mode="wait">
          {active === null ? (
            <motion.div
              key="rest"
              className="agd__islands"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <IslandDoor
                verb="Prospect" tagline="Reach people — your CRM, the map, skip-trace, mail."
                img="/sky/island-home.png" onClick={() => setActive('prospect')}
              />
              <IslandDoor
                verb="Transact" tagline="Do the deal — offers, documents, your client portal."
                img="/sky/island-pin.png" onClick={() => setActive('transact')}
                hint={`${DEMO_PACKAGE.buyer.name.split(' ')[0]} · in escrow`}
              />
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              className="agd__panel"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22 }}
            >
              <button className="agd__collapse" onClick={() => setActive(null)}>
                <MaterialIcon icon="arrow_back" className="text-[18px]" /> Back
              </button>
              {active === 'prospect' ? (
                <ProspectWorkspace
                  onAdd={() => setAddOpen(true)}
                  refreshKey={refreshKey}
                  onSelectLead={selectLead}
                  onImport={() => router.push('/imports')}
                />
              ) : (
                <TransactWorkspace onDocs={() => router.push('/documents')} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── personal corner: your own move-requests (compact) + settings ── */}
        {active === null && (
          <div className="agd__personal">
            <span className="agd__personal-label"><MaterialIcon icon="explore" className="text-[15px]" /> Your moves</span>
            <div className="agd__moves">
              {myRequests.length === 0 ? (
                <a href="/post" className="agd__move agd__move--add"><MaterialIcon icon="add" className="text-[15px]" /> Post a move</a>
              ) : (
                myRequests.slice(0, 3).map((r) => (
                  <a key={r.id} href={`/my-request?id=${r.id}`} className="agd__move">
                    <MaterialIcon icon="place" className="text-[13px]" />
                    {r.to_label?.split(',')[0] || 'A move'}
                  </a>
                ))
              )}
            </div>
            <a href="/settings" className="agd__settings"><MaterialIcon icon="settings" className="text-[16px]" /></a>
          </div>
        )}
      </div>

      {addOpen && (
        <AddClientForm onAdded={() => setRefreshKey((k) => k + 1)} onClose={() => setAddOpen(false)} />
      )}

      <style>{`
        .agd { position: relative; min-height: calc(100svh - 65px); overflow: hidden;
          background: linear-gradient(180deg, #cfe0f6 0%, #dbe8fa 46%, #eef4fd 100%); }
        .agd__sky { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
        .agd__sun { position: absolute; inset: 0;
          background: radial-gradient(22vw 22vw at 88% 4%, rgba(255,243,218,0.38), rgba(255,243,218,0) 68%); }
        .agd__cloud { position: absolute; opacity: 0.7; }
        .agd__cloud.c1 { left: 6%; top: 10%; width: clamp(80px,10vw,150px); }
        .agd__cloud.c2 { right: 6%; bottom: 8%; width: clamp(140px,16vw,260px); opacity: 0.6; }

        .agd__wrap { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto;
          padding: clamp(20px, 4vh, 44px) 24px 32px; }
        .agd__eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: ${BRAND}; }
        .agd__h { font-size: clamp(2rem, 4.5vw, 3rem); font-weight: 800; letter-spacing: -0.02em; color: ${INK}; margin-top: 6px; }

        /* rest state — two island doors */
        .agd__islands { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: clamp(24px, 5vh, 56px); }
        @media (max-width: 720px) { .agd__islands { grid-template-columns: 1fr; } }

        /* expanded workspace */
        .agd__panel { margin-top: 20px; background: rgba(255,255,255,0.82); border: 1px solid rgba(19,73,212,0.12);
          border-radius: 24px; padding: 18px; backdrop-filter: blur(6px); box-shadow: 0 24px 56px -34px rgba(20,50,120,0.45);
          max-height: calc(100svh - 150px); overflow-y: auto; }
        .agd__collapse { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer;
          font-size: 14px; font-weight: 700; color: ${BRAND}; padding: 4px 0 12px; }
        .agd__collapse:hover { color: ${INK}; }

        /* personal corner */
        .agd__personal { display: flex; align-items: center; gap: 12px; margin-top: 28px; flex-wrap: wrap; }
        .agd__personal-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #6b7699; }
        .agd__moves { display: flex; gap: 8px; flex-wrap: wrap; }
        .agd__move { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 999px;
          background: rgba(255,255,255,0.8); border: 1px solid rgba(19,73,212,0.14); font-size: 12.5px; font-weight: 600;
          color: ${INK}; text-decoration: none; }
        .agd__move:hover { border-color: rgba(19,73,212,0.4); }
        .agd__move--add { color: ${BRAND}; }
        .agd__settings { margin-left: auto; color: #6b7699; display: inline-flex; }
        .agd__settings:hover { color: ${INK}; }
      `}</style>
    </div>
  );
}

// ── an island door (rest state) ───────────────────────────────────────
function IslandDoor({ verb, tagline, img, onClick, hint }: {
  verb: string; tagline: string; img: string; onClick: () => void; hint?: string;
}) {
  return (
    <motion.button className="idoor" onClick={onClick} whileHover={{ y: -4 }} transition={{ duration: 0.15 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt="" className="idoor__img" draggable={false} />
      <div className="idoor__body">
        <div className="idoor__verb">{verb}</div>
        <div className="idoor__tag">{tagline}</div>
        {hint && <div className="idoor__hint"><span className="idoor__dot" /> {hint}</div>}
      </div>
      <MaterialIcon icon="arrow_forward" className="idoor__go text-[20px]" />
      <style>{`
        .idoor { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
          text-align: left; cursor: pointer; padding: 26px 26px 22px; border-radius: 26px;
          background: rgba(255,255,255,0.72); border: 1px solid rgba(19,73,212,0.12);
          box-shadow: 0 22px 50px -34px rgba(20,50,120,0.5); transition: border-color .16s, box-shadow .16s; }
        .idoor:hover { border-color: rgba(19,73,212,0.4); box-shadow: 0 30px 60px -32px rgba(20,50,120,0.55); }
        .idoor__img { width: clamp(120px, 16vw, 180px); margin: -6px 0 2px; }
        .idoor__verb { font-family: var(--font-headline, inherit); font-weight: 800; font-size: 1.7rem; color: var(--plot-brand-deep, #122d8d); }
        .idoor__tag { font-size: 13.5px; color: #46536b; line-height: 1.45; max-width: 30ch; }
        .idoor__hint { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12.5px; font-weight: 700; color: var(--plot-brand, #1349d4); }
        .idoor__dot { width: 7px; height: 7px; border-radius: 50%; background: #0f8a5f; box-shadow: 0 0 0 3px rgba(15,138,95,0.18); }
        .idoor__go { position: absolute; right: 22px; bottom: 22px; color: var(--plot-brand, #1349d4); }
      `}</style>
    </motion.button>
  );
}

// ── PROSPECT workspace (expanded) ─────────────────────────────────────
function ProspectWorkspace({ onAdd, refreshKey, onSelectLead, onImport }: {
  onAdd: () => void; refreshKey: number; onSelectLead: (l: Lead) => void; onImport: () => void;
}) {
  return (
    <div>
      <div className="pw__head">
        <div>
          <div className="pw__eyebrow">Prospect</div>
          <h2 className="font-headline pw__h">Your people</h2>
        </div>
      </div>
      <LeadsList
        embedded
        refreshKey={refreshKey}
        onSelectLead={onSelectLead}
        onImport={onImport}
        headerActions={
          <button className="pw__add" onClick={onAdd}>
            <MaterialIcon icon="person_add" className="text-[16px]" /> Add client
          </button>
        }
      />
      <style>{`
        .pw__head { margin-bottom: 12px; }
        .pw__eyebrow { font-size: 10.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--plot-brand, #1349d4); }
        .pw__h { font-size: 1.5rem; font-weight: 800; color: var(--plot-brand-deep, #122d8d); }
        .pw__add { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 10px;
          background: var(--plot-brand, #1349d4); color: #fff; font-weight: 700; font-size: 13.5px; cursor: pointer; }
        .pw__add:hover { background: var(--plot-brand-deep, #122d8d); }
      `}</style>
    </div>
  );
}

// ── TRANSACT workspace (expanded, real shell) ─────────────────────────
// v1: renders the active deal (Alberto) via DealRoomGate off the demo
// package. Real persisted escrow (client→deal→docs) is the next pass.
function TransactWorkspace({ onDocs }: { onDocs: () => void }) {
  return (
    <div>
      <div className="tw__head">
        <div>
          <div className="tw__eyebrow">Transact</div>
          <h2 className="font-headline tw__h">Your active deal</h2>
        </div>
        <button className="tw__docs" onClick={onDocs}>
          <MaterialIcon icon="description" className="text-[16px]" /> Documents
        </button>
      </div>
      <DealRoomGate pkg={DEMO_PACKAGE} />
      <style>{`
        .tw__head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
        .tw__eyebrow { font-size: 10.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--plot-brand, #1349d4); }
        .tw__h { font-size: 1.5rem; font-weight: 800; color: var(--plot-brand-deep, #122d8d); }
        .tw__docs { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px;
          background: #fff; border: 1px solid rgba(19,73,212,0.2); color: var(--plot-brand, #1349d4); font-weight: 700; font-size: 13.5px; cursor: pointer; }
        .tw__docs:hover { border-color: rgba(19,73,212,0.5); }
      `}</style>
    </div>
  );
}
