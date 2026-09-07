'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>The repository is temporarily unavailable.</h1>
      <p>This is not evidence that there are no solutions.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
