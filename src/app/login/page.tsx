import { redirect } from 'next/navigation';

// /login is dead. The only sign-in surface is now the new front page (/),
// whose Get Started / Log in buttons kick off Google OAuth directly. Any
// hit on /login (old inbound links, emails, deep links) bounces home.
export default function LoginRedirect() {
  redirect('/');
}
