'use client';

// ShareBullpen — the heart of the agent tool.
//
// A buyer's position is now a LINK. This screen turns that link into something
// three concentric networks broadcast (memory/project_position_job_posting_architecture
// "who builds + shares it"):
//   1. the AGENT's professional circle (lenders they know → instant legitimacy)
//   2. the BUYER's own social reach
//   3. the buyer's FAMILY + FRIENDS — the ones who WANT them to get a home
//
// Two warm motives, one link: "hand a lead to a lender you rate" +
// "help someone you love get their home." Zero-cost, goodwill-powered. The
// link is the product; everything else points at it.

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function ShareBullpen({
  slug,
  buyerName,
  hasAgent,
  agentName,
}: {
  slug: string;
  buyerName?: string | null;
  hasAgent?: boolean;
  agentName?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  // Absolute URL for sharing (falls back to a relative path during SSR).
  const path = `/b/${slug}`;
  const url =
    typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

  const who = buyerName ? `${buyerName}'s` : 'this';
  const shareText = `Help ${buyerName ? buyerName : 'a home buyer'} get the best deal on their mortgage. Lenders — take a look and put your best offer in. Everyone else — pass it to a great lender you know. 🏡`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the input is selectable as a fallback
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: `${who} home-buying position`,
          text: shareText,
          url,
        });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    copy();
  };

  const enc = encodeURIComponent;
  const channels: { id: string; label: string; icon: string; href: string }[] = [
    {
      id: 'sms',
      label: 'Text it',
      icon: 'sms',
      href: `sms:?&body=${enc(`${shareText} ${url}`)}`,
    },
    {
      id: 'email',
      label: 'Email',
      icon: 'mail',
      href: `mailto:?subject=${enc(`${who} home-buying position`)}&body=${enc(`${shareText}\n\n${url}`)}`,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: 'public',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    },
    {
      id: 'x',
      label: 'X',
      icon: 'tag',
      href: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(url)}`,
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: 'chat',
      href: `https://wa.me/?text=${enc(`${shareText} ${url}`)}`,
    },
  ];

  return (
    <div className="shb">
      <div className="shb-hero">
        <div className="shb-badge"><MaterialIcon icon="rocket_launch" className="text-[30px]" /></div>
        <h2 className="shb-h">Your position is live. Now let it travel.</h2>
        <p className="shb-sub">
          This is your link. The more people who pass it to a lender they trust,
          the more offers come in — and the better your deal gets. Share it far
          and wide.
        </p>
        {agentName && (
          <div className="shb-agent">
            <MaterialIcon icon="check_circle" className="text-[16px]" />
            {agentName} is attached as your agent — they&apos;ll see it too.
          </div>
        )}
      </div>

      {/* the link itself — the product */}
      <div className="shb-linkrow">
        <input className="shb-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button className="shb-copy" onClick={copy}>
          <MaterialIcon icon={copied ? 'check' : 'content_copy'} className="text-[18px]" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* one-tap native share (mobile) */}
      <button className="shb-share-primary" onClick={nativeShare}>
        <MaterialIcon icon="ios_share" className="text-[19px]" />
        Share your link
      </button>

      {/* explicit channels */}
      <div className="shb-channels">
        {channels.map((c) => (
          <a key={c.id} className="shb-channel" href={c.href} target="_blank" rel="noopener noreferrer">
            <MaterialIcon icon={c.icon} className="text-[20px]" />
            <span>{c.label}</span>
          </a>
        ))}
      </div>

      {/* the three networks — who to send it to, and why it works */}
      <div className="shb-networks">
        <div className="shb-networks__title">Who should get it</div>

        <Network
          icon="handshake"
          title="Your agent's lenders"
          body={
            hasAgent
              ? 'Your agent can drop this into their circle of lenders. When a lender sees it came from an agent they know, they already trust it’s real — and they compete for you.'
              : 'If you have an agent, ask them to send this to the lenders they know. A lender trusts a lead from an agent they know — that trust is worth more than any form.'
          }
        />
        <Network
          icon="groups"
          title="Your own people"
          body="Post it wherever you already are — your feed, your group chats. Every share widens the pool of lenders who might see it and bid."
        />
        <Network
          icon="volunteer_activism"
          title="Family & friends"
          body="This one’s the secret. The people who love you want you in a home — and passing a link costs them nothing. “My daughter’s buying her first place, anyone know a great lender?” is the kind of thing people share gladly."
        />
      </div>

      {/* what happens next */}
      <div className="shb-next">
        <MaterialIcon icon="schedule" className="text-[18px]" />
        <p>
          Offers land on your page as lenders find you — over the next hours and
          days. The moment one puts a real number down, it tells every other
          lender you’re a serious buyer, and more come to compete.
        </p>
      </div>

      <a href={path} className="shb-view">See your live page →</a>
    </div>
  );
}

function Network({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="shb-net">
      <div className="shb-net__icon"><MaterialIcon icon={icon} className="text-[20px]" /></div>
      <div>
        <div className="shb-net__title">{title}</div>
        <p className="shb-net__body">{body}</p>
      </div>
    </div>
  );
}
