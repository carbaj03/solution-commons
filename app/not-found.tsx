import Link from 'next/link';
export default function Missing() {
  return (
    <main>
      <h1>Solution not found.</h1>
      <Link href="/solutions">Browse public solutions →</Link>
    </main>
  );
}
