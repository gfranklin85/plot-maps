// ── Essays — the public ideas series ("Delete the Structure, Not the
// Symptom"). Each essay is the canonical statement of one industry-flipping
// idea, in plain forceful prose. The flare: pure idea up top, a quiet founder
// doorway at the bottom (this isn't a thought I had on the shitter — there's
// a working tool + a real brokerage behind it).
// See memory/project_rollout_sequence_thinking.

export interface Essay {
  slug: string;
  title: string;
  dek: string;        // the subtitle / standfirst
  date: string;       // display date
  readingMinutes: number;
  /** body as an ordered list of blocks; rendered by the essay page. */
  body: EssayBlock[];
}

export type EssayBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

export const ESSAYS: Essay[] = [
  {
    slug: 'the-manufactured-squabble',
    title: 'The Manufactured Squabble',
    dek: 'On the line in the contract that invents a fight where none had to exist.',
    date: 'June 2026',
    readingMinutes: 5,
    body: [
      { kind: 'p', text: 'There is a page in the standard purchase contract that almost no one questions, because it looks like plain bookkeeping. It’s titled Allocation of Costs. Underneath it sits a grid — eighteen little rows, one for each incidental of a home sale. The escrow fee. The transfer tax. The HOA certification fee. The wildfire disclosure report. The title policy. And beside every single one, three small boxes:' },
      { kind: 'quote', text: 'Buyer ☐  Seller ☐  Both ☐' },
      { kind: 'p', text: 'It reads like neutral plumbing. It is not. That grid is the most quietly destructive thing in the entire document, and once you see why, you can’t unsee it.' },
      { kind: 'hr' },
      { kind: 'h2', text: 'The box is the problem' },
      { kind: 'p', text: 'Here is the sleight of hand. The costs of a transaction are real — somebody has to cover the escrow company, the county, the title insurer. That part is true and unavoidable. But the grid does something the costs never asked it to do. It takes a cost and assigns it to a person.' },
      { kind: 'p', text: 'And the instant a cost has a name on it, that person becomes its owner. And the instant they own it, they believe they’re in charge of it. Now there is a thing to defend. A thing to negotiate down, to push across the table, to win or to lose. A flag has been planted on a hill that didn’t exist five seconds ago.' },
      { kind: 'p', text: 'The grid doesn’t record a negotiation. It manufactures one. It invents the very ground the fight is fought on. Strike the names off the page and the fight has nowhere to stand — not because anyone made peace, but because there was never anything there to fight over.' },
      { kind: 'p', text: 'That is the trick at the heart of so much of this business: the structure creates the behavior, and then everyone blames the behavior. We treat the squabbling as human nature — of course people haggle over who pays what — when the squabbling is simply what that grid grows. Hand two reasonable people a form with eighteen ownership decisions on it and they will, dutifully, find eighteen things to be tense about. Hand them a clean deal and they’ll shake hands.' },
      { kind: 'hr' },
      { kind: 'h2', text: 'It was never yours, or theirs' },
      { kind: 'p', text: 'Now the deeper truth, the one the grid is built to obscure.' },
      { kind: 'p', text: 'These costs are not the buyer’s to pay. They are not the seller’s to pay. They are paid by the deal. They come out of the transaction itself — financed, folded into the number, carried by the loan that the whole arrangement is built on. The money was always going to move through the transaction and settle these costs on its way. Putting a human name next to each one is a fiction. A costume. It dresses up an automatic function of the deal as a personal obligation, for no reason other than to give people something to argue about.' },
      { kind: 'p', text: 'So the honest version of that entire page is one sentence:' },
      { kind: 'quote', text: 'All of this is paid out of the deal. Not by you. Not by them.' },
      { kind: 'p', text: 'Ownerless. The transaction covers its own costs, the way it always could have, and no one has to stand guard over a fee that was never theirs to begin with. There’s no column to negotiate because there’s no owner to assign. The squabble doesn’t get resolved. It never gets born.' },
      { kind: 'hr' },
      { kind: 'h2', text: 'And they weren’t even crumbs' },
      { kind: 'p', text: 'But here’s the part that turns a clever observation into something that should make you angry.' },
      { kind: 'p', text: 'We call these line items “incidentals.” Crumbs. The little stuff you split at the end. And for the buyer and seller, fine — relative to the price of a home, they are small. But look at what’s actually sitting in that grid, and look at who it really lands on.' },
      { kind: 'p', text: 'It lands on the agents. The people who assembled the entire thing. Who found the buyer, brought the offer, built the deal, carried it across the line. Their livelihood is threaded through these costs and credits — and the contract has them squabbling over their own compensation as if it were a stray fee to be haggled, crumbs they don’t even own.' },
      { kind: 'p', text: 'That’s the cruelty of it. The form doesn’t just manufacture a fight between buyer and seller. It quietly conscripts the very people who made the deal possible into fighting over scraps of their own keep — and convinces them that’s normal. The most valuable people in the room, reduced to arguing for crumbs they were already owed.' },
      { kind: 'hr' },
      { kind: 'h2', text: 'Delete the structure, not the symptom' },
      { kind: 'p', text: 'The fix is not to be a better negotiator on the grid. It’s not a tactic, a script, or a softer way to ask who pays the transfer tax. The fix is to delete the grid.' },
      { kind: 'p', text: 'You don’t manage a fight the form created. You remove the form that creates it. No assignment, no ownership, no ego, no fight. The deal covers its own costs, the seller sees one clean number that is honestly theirs to keep, the buyer brings the money the only way it was ever going to come, and the agents are paid for the thing they built instead of made to scrap for it.' },
      { kind: 'p', text: 'It turns out almost everything broken in this process works the same way. The abstract lump-sum price manufactures scarcity panic. The phrase “remove contingency” manufactures the feeling of surrender. A line asking the seller to please compensate the buyer’s broker manufactures a beggar out of the person who delivered the goods. In every case the document itself is growing the bad behavior — and in every case the answer is the same: you don’t moderate what the structure produces. You take away the structure.' },
      { kind: 'p', text: 'That’s the whole game. The incumbents will spend forever trying to make people behave better inside forms designed to make them behave badly. We just throw out the form.' },
      { kind: 'p', text: 'There were never any crumbs. There was only ever the deal, and the people who made it.' },
    ],
  },
];

export function findEssay(slug: string): Essay | undefined {
  return ESSAYS.find((e) => e.slug === slug);
}
